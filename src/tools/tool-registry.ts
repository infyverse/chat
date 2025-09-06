import { z, ZodType } from 'zod'
import {
  addToolUrl,
  getAllToolData,
  setToolState,
  deleteToolUrl as dbDeleteToolUrl,
} from '../database/chats'
type ToolType = {
  name: string
  description: string
  paramsSchema: object
  callback: (args: any) => Promise<any>
  tags?: string[]
  sourceUrl?: string
  enabled?: boolean
}

/**
 * Represents a single tool that can be executed.
 */
export class Tool {
  name: string
  description: string
  paramsSchema: ZodType
  callback: (args: any) => Promise<any>
  tags: string[]
  sourceUrl?: string
  enabled: boolean

  constructor({
    name,
    description,
    paramsSchema,
    callback,
    tags,
    sourceUrl,
    enabled = true,
  }: ToolType) {
    if (!name || !description || !paramsSchema || !callback) {
      throw new Error(
        'Tool is missing required properties: name, description, paramsSchema, callback are required.'
      )
    }
    this.name = name
    this.description = description
    this.sourceUrl = sourceUrl
    this.enabled = enabled

    const finalSchema = Object.entries(paramsSchema).reduce((acc, [key, value]) => {
      if (value instanceof z.ZodType) {
        acc[key] = value
      } else if (
        typeof value === 'object' &&
        value !== null &&
        'type' in value &&
        value.type === 'string'
      ) {
        acc[key] = z.string().describe((value as any).description || '')
      } else {
        console.warn(`Unsupported schema definition for key "${key}". Defaulting to z.any().`)
        acc[key] = z.any()
      }
      return acc
    }, {} as Record<string, ZodType>)

    this.paramsSchema = z.object(finalSchema)
    this.callback = callback
    this.tags = tags || []
  }

  /**
   * Executes the tool with the given arguments.
   * @param {object} args - The arguments for the tool, matching the paramsSchema.
   * @returns {Promise<any>} The result of the tool's execution.
   */
  async execute(args: object): Promise<any> {
    if (!this.enabled) {
      return Promise.resolve('This tool is currently disabled.')
    }
    const validatedArgs = this.paramsSchema.parse(args)
    return this.callback(validatedArgs)
  }

  /**
   * Toggles the enabled state of the tool.
   */
  toggle() {
    this.enabled = !this.enabled
    if (this.sourceUrl) {
      setToolState(this.sourceUrl, this.name, this.enabled)
    }
  }
}

/**
 * Manages a collection of tools.
 */
export class ToolManager {
  tools: Map<string, Tool>
  events: EventTarget

  constructor() {
    this.tools = new Map<string, Tool>()
    this.events = new EventTarget()
    this.loadFromSavedUrls()
  }
  /**
   * Loads tools from all URLs saved in the database.
   */
  async loadFromSavedUrls() {
    const allToolData = await getAllToolData()
    for (const toolData of allToolData) {
      await this.loadFromUrl(toolData.url, false) // Don't save the URL again
      if (toolData.tools) {
        for (const toolName in toolData.tools) {
          const tool = this.get(toolName)
          if (tool) {
            tool.enabled = toolData.tools[toolName].enabled
          }
        }
      }
    }
    this.events.dispatchEvent(new Event('tools-updated'))
  }

  /**
   * Deletes all tools from a given URL and removes the URL from the database.
   * @param {string} url - The source URL of the tools to delete.
   */
  async deleteToolsFromUrl(url: string) {
    // Unregister tools from the ToolManager
    const toolsToDelete = this.getAll().filter((tool) => tool.sourceUrl === url)
    toolsToDelete.forEach((tool) => this.tools.delete(tool.name))

    // Remove the URL and its data from the database
    await dbDeleteToolUrl(url)

    // Notify listeners that tools have been updated
    this.events.dispatchEvent(new Event('tools-updated'))
  }

  /**
   * Registers a tool.
   * @param {Tool} toolInstance - An instance of the Tool class.
   */
  register(toolInstance: Tool) {
    if (!(toolInstance instanceof Tool)) {
      throw new Error('Can only register instances of Tool.')
    }
    if (this.tools.has(toolInstance.name)) {
      console.warn(`Tool "${toolInstance.name}" is already registered. It will be overwritten.`)
    }
    this.tools.set(toolInstance.name, toolInstance)
    this.events.dispatchEvent(new Event('tools-updated'))
  }

  /**
   * Retrieves a tool by its name.
   * @param {string} name - The name of the tool to retrieve.
   * @returns {Tool | undefined} The tool instance, or undefined if not found.
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  /**
   * Returns an array of all registered tools.
   * @returns {Tool[]}
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values())
  }

  /**
   * Dynamically loads tools from a JSON manifest at a given URL.
   * The manifest is expected to contain a 'js' property with a relative path to the JS module.
   * @param {string} url - The URL of the JSON manifest to load.
   * @param {boolean} [saveUrl=true] - Whether to save the URL to the database.
   */
  async loadFromUrl(url: string, saveUrl = true) {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const manifest = await response.json()

      if (typeof manifest.js !== 'string') {
        throw new Error('Manifest must contain a "js" property pointing to the tool script.')
      }

      // Resolve the relative path of the JS module against the manifest URL
      const jsUrl = new URL(manifest.js, url).href

      // Using dynamic import to load the module from the URL.
      const module = await import(/* webpackIgnore: true */ jsUrl)

      if (module.default && Array.isArray(module.default)) {
        module.default.forEach((toolConfig: ToolType) => {
          try {
            // The sourceUrl should be the manifest URL, not the JS URL
            const tool = new Tool({ ...toolConfig, sourceUrl: url })
            this.register(tool)
          } catch (e) {
            console.error(`Error creating tool from config:`, toolConfig, e)
          }
        })
        console.log(`Successfully loaded and registered tools from ${url}`)
        if (saveUrl) {
          await addToolUrl(url)
        }
      } else {
        console.warn(`Module from ${jsUrl} does not have a default export of type Array.`)
      }
    } catch (error) {
      console.error(`Failed to load tools from URL "${url}":`, error)
    }
  }
}
