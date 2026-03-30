export type ToolParameterType = 'string' | 'number' | 'boolean' | 'object' | 'array'

export interface ToolParameter {
  name: string
  type: ToolParameterType
  description: string
  required: boolean
  enum?: string[]
  default?: unknown
  items?: { type: 'string' | 'number' | 'boolean' | 'object' }
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: ToolParameter[]
}
