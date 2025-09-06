/**
 * Removes markdown code block syntax
 * @param text - Text to process
 * @returns Text with markdown removed
 */
function stripMarkdown(text: string): string {
  // Remove ``` code blocks
  text = text.replace(/```(?:json)?\n([\s\S]*?)\n```/g, '$1')
  // Remove single ` blocks
  text = text.replace(/`([^`]*)`/g, '$1')
  return text.trim()
}

/**
 * Finds potential JSON strings in text
 * @param text - Text to search
 * @returns Array of potential JSON strings
 */
function findJsonStrings(text: string): string[] {
  const jsonStrings: string[] = []
  let depth = 0
  let startIndex = -1

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (char === '{') {
      if (depth === 0) {
        startIndex = i
      }
      depth++
    } else if (char === '}') {
      depth--
      if (depth === 0 && startIndex !== -1) {
        jsonStrings.push(text.substring(startIndex, i + 1))
      }
    }
  }

  return jsonStrings
}

/**
 * Attempts to parse a JSON string
 * @param jsonString - String to parse
 * @returns Parsed JSON or null if invalid
 */
function tryParseJson(jsonString: string): object | null {
  try {
    const cleaned = jsonString.replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
    const parsed = JSON.parse(cleaned)
    return isValidJson(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * Validates if the parsed JSON matches expected structure
 * @param json - Parsed JSON to validate
 * @returns Whether the JSON is valid
 */
function isValidJson(json: any): boolean {
  // Add your specific validation rules here
  return typeof json === 'object' && json !== null
}

interface ExtractJSONOptions {
  removeMarkdown?: boolean
  allowMultiple?: boolean
}

/**
 * Attempts to extract valid JSON from text that might contain other content
 * @param text - The raw text from LLM
 * @param options - Configuration options
 * @returns Parsed JSON object(s) or null if none found
 */
export function extractJSON(
  text: any,
  options: ExtractJSONOptions = { removeMarkdown: false, allowMultiple: false }
): object | object[] | null {
  if (!text) return null

  try {
    // Handle markdown code blocks
    let processedText = text
    if (options.removeMarkdown) {
      processedText = stripMarkdown(text)
    }

    // Find all potential JSON strings
    const jsonMatches = findJsonStrings(processedText)
    if (!jsonMatches.length) return null

    // Parse and validate found JSON strings
    const validJsonObjects = jsonMatches
      .map((jsonString) => tryParseJson(jsonString))
      .filter((result) => result !== null)

    if (!validJsonObjects.length) return null

    // Return based on allowMultiple option
    return options.allowMultiple ? validJsonObjects : validJsonObjects[0]
  } catch (error) {
    console.error('Error extracting JSON:', error)
    return null
  }
}
