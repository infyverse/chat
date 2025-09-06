import { generateId } from '../utils/id'
import { urlToGenerativePart } from '../utils/image'
import { Tool, ToolManager } from './tool-registry'
import { extractJSON } from '../utils/json'
import { Message, ToolCalls, GenerativePart } from '../types'

export const toolManager = new ToolManager()

const generateToolCallingSystemPrompt = (availableTools: Tool[]): string => {
  const toolDescriptions = availableTools
    .map((tool) => {
      let params = ''
      if (tool.paramsSchema && 'shape' in tool.paramsSchema) {
        const shape = (tool.paramsSchema as any).shape
        params = Object.keys(shape)
          .map((key) => {
            const schema = shape[key]
            return `  - ${key}: ${schema.description || 'string'}`
          })
          .join('\n')
      }

      return `- **${tool.name}**: ${tool.description}\n  Parameters:\n${params}`
    })
    .join('\n\n')

  return `System Instructions: You are a helpful assistant with access to tools. Always respond in markdown plain text code block. When you need to use a tool, add a JSON code block containing the tool call to the markdown response. Only output markdown plain text code block inside a markdown response. So output markdown in markdown.

Available Tools:
${toolDescriptions}

Tool Call Format:
When you want to use a tool, include a Markdown code block containing a JSON code block in your response like this:

Markdown Output Example:
# Sample Markdown with JSON Block

This is a sample Markdown document demonstrating how to include a JSON code block.

## Tool Calls
\`\`\`json
{
  "tool_calls": [
    {
      "name": "tool_name",
      "parameters": {
        "param1": "value1",
        "param2": "value2"
      }
    }
  ]
}
\`\`\`

You can call multiple tools by adding more objects to the tool_calls array. Always provide a natural language response explaining what you're doing, then include the tool call JSON block in Markdown format.

Rules:
1. Only use tools that are available in the list above
2. Ensure all required parameters are provided
3. Provide helpful context before making tool calls
4. If no tools are needed, respond normally without JSON blocks`
}

export const parseToolCalls = (text: string): any[] => {
  const toolCalls: any[] = []

  const parsed = extractJSON(text)
  if (
    parsed &&
    typeof parsed === 'object' &&
    'tool_calls' in parsed &&
    Array.isArray((parsed as ToolCalls).tool_calls)
  ) {
    toolCalls.push(...(parsed as ToolCalls).tool_calls)
  }

  return toolCalls
}

export const executeToolCalls = async (
  toolCalls: any[],
  addResponseCallback: (response: Message) => void
): Promise<any[]> => {
  const results: any[] = []

  for (const toolCall of toolCalls) {
    try {
      const tool = toolManager.get(toolCall.name)

      if (!tool) {
        console.warn(`Tool not found: ${toolCall.name}`)
        results.push({
          tool: toolCall.name,
          success: false,
          error: `Tool '${toolCall.name}' not found`,
        })
        continue
      }

      const params = toolCall.parameters || {}

      console.log(`[Tool Execution] Calling ${toolCall.name} with params:`, params)

      const result = await tool.execute({
        ...params,
        callback: addResponseCallback,
      })

      results.push({
        tool: toolCall.name,
        success: true,
        result: result,
      })

      if (result && result.content) {
        const id = generateId()
        addResponseCallback({
          id: id,
          text: result.content[0].text,
          sender: `${toolCall.name}`,
          timestamp: Date.now(),
        })
      }
    } catch (error: any) {
      console.error(`Error executing tool ${toolCall.name}:`, error)
      results.push({
        tool: toolCall.name,
        success: false,
        error: error.message,
      })
    }
  }

  return results
}

export const toolProcessor = async (
  userText: string,
  messages: Message[] = [],
  addResponseCallback: (response: Message) => void,
  attachments: string[] = []
): Promise<void> => {
  try {
    console.log('messages', messages)

    if (userText.startsWith('@note')) {
      return
    }
    let selectedTool = toolManager.get('Gemini | aistudio.google.com')
    if (selectedTool) {
      let id = generateId()

      if (selectedTool.tags.includes('Text Generation')) {
        const availableToolsForCalling = toolManager
          .getAll()
          .filter((tool) => !tool.tags.includes('Text Generation'))

        let messagesForTool: any[] = messages.map((message) => {
          const isImageGenerator = /image generator/i.test(message.sender)
          return {
            role: message.sender === 'user' ? 'user' : 'assistant',
            content: isImageGenerator ? '[Images...]' : message.text,
          }
        })

        messagesForTool.unshift({
          role: 'system',
          content: generateToolCallingSystemPrompt(availableToolsForCalling),
        })

        const userMessageContent: any[] = [{ type: 'text', text: userText }]
        if (attachments && attachments.length > 0) {
          for (const url of attachments) {
            try {
              const generativePart: GenerativePart = await urlToGenerativePart(url)
              if (generativePart) {
                userMessageContent.push({
                  type: 'image_url',
                  image_url: {
                    url: `data:${generativePart.inlineData.mimeType};base64,${generativePart.inlineData.data}`,
                  },
                })
              }
            } catch (error) {
              console.error(`Failed to process attachment URL: ${url}`, error)
            }
          }
        }

        messagesForTool.push({
          role: 'user',
          content:
            userMessageContent.length === 1 ? userMessageContent[0].text : userMessageContent,
        })

        console.log({ messagesForTool })

        let result = await selectedTool.execute({
          model: 'gemini-2.0-flash',
          messages: messagesForTool,
          callback: (text: string) => {
            addResponseCallback({
              id: id,
              text: text,
              sender: selectedTool!.name,
              timestamp: Date.now(),
            })
          },
        })
        console.log('[Tool] result:', result)
        addResponseCallback({
          id: id,
          text: result.content[0].text,
          sender: selectedTool.name,
          timestamp: Date.now(),
        })

        const toolCalls = parseToolCalls(result.content[0].text)
        console.log('[Tool Calls] Output:', toolCalls)

        if (toolCalls && toolCalls.length > 0) {
          console.log('[Tool Calls] Found tool calls:', toolCalls)

          const toolResults = await executeToolCalls(toolCalls, addResponseCallback)

          console.log('[Tool Results]:', toolResults)

          const successfulCalls = toolResults.filter((r) => r.success)
          const failedCalls = toolResults.filter((r) => !r.success)

          if (failedCalls.length > 0) {
            const errorSummary = failedCalls.map((f) => `${f.tool}: ${f.error}`).join(', ')
            addResponseCallback({
              id: generateId(),
              text: `⚠️ ${errorSummary}`,
              sender: 'System',
              timestamp: Date.now(),
            })
          }
        }
      }
    }
  } catch (error: any) {
    console.error('\nError during pseudo communication:', error)

    addResponseCallback({
      id: generateId(),
      text: `❌ ${error.message}`,
      sender: 'System',
      timestamp: Date.now(),
    })
  }
}
