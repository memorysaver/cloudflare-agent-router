/**
 * Shared types for Claude Code API integration
 * Single source of truth for request/response interfaces
 */

export interface ClaudeCodeRequest {
	// Required (prompt for text format, messages for stream-json format)
	prompt?: string
	messages?: Array<{
		role: 'user' | 'assistant'
		content: Array<{
			type: 'text'
			text: string
		}>
	}>

	// Input/Output Format Configuration
	inputFormat?: 'text' | 'stream-json' // Default: "text"
	outputFormat?: 'text' | 'json' | 'stream-json' // Default: "json"
	model?: string // Default: "groq/openai/gpt-oss-120b"
	stream?: boolean // Default: true (deprecated - use outputFormat instead)
	verbose?: boolean // Default: false

	// Claude Code SDK Core Options
	maxTurns?: number // Default: 3
	systemPrompt?: string // Default: "" (empty - let Claude Code use default)
	appendSystemPrompt?: string // Default: undefined

	// Tool Management
	allowedTools?: string[] // Default: undefined (all tools)
	disallowedTools?: string[] // Default: undefined

	// Session Management
	sessionId?: string // Optional: provide to resume existing session
	continueSession?: boolean // Default: false
	resumeSessionId?: string // Default: undefined

	// Permission & Security
	permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions' // Default: "acceptEdits"
	permissionPromptTool?: string // Default: undefined

	// MCP Configuration
	mcpConfig?: object // Default: undefined (JSON object that will be saved as .mcp.json)

	// Runtime Configuration
	cwd?: string // Default: undefined
	executable?: string // Default: undefined
	executableArgs?: string[] // Default: undefined
	pathToClaudeCodeExecutable?: string // Default: undefined

	// Legacy (for backward compatibility)
	additionalArgs?: string[] // Deprecated - use executableArgs
}

export interface ClaudeCodeError {
	error: string
	message: string
	details?: string
}

export interface ProcessedClaudeCodeOptions extends ClaudeCodeRequest {
	// All required fields filled with defaults
	inputFormat: 'text' | 'stream-json'
	outputFormat: 'text' | 'json' | 'stream-json'
	model: string
	stream: boolean
	verbose: boolean
	maxTurns: number
	systemPrompt: string
	continueSession: boolean
	permissionMode: 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions'
	additionalArgs: string[]
}

/**
 * Legacy agent message format for backward compatibility
 */
export interface LegacyAgentRequest {
	message: string
	sessionId?: string
	permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions'
}

/**
 * Unified agent request format (supports both legacy and new formats)
 */
export type AgentRequest = LegacyAgentRequest | ClaudeCodeRequest

/**
 * Environment variables for Claude Code execution
 */
export interface ClaudeCodeEnvVars {
	ANTHROPIC_AUTH_TOKEN: string
	ANTHROPIC_BASE_URL: string
	ANTHROPIC_API_KEY?: string
	ANTHROPIC_MODEL: string
}