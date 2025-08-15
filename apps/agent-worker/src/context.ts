import type { HonoApp } from '@repo/hono-helpers'
import type { SharedHonoEnv, SharedHonoVariables } from '@repo/hono-helpers/src/types'
import type { ClaudeCodeContainer } from './claude-container'

export type Env = SharedHonoEnv & {
	// Claude Code Container binding
	CLAUDE_CONTAINER: DurableObjectNamespace<ClaudeCodeContainer>

	// Anthropic API configuration
	ANTHROPIC_API_KEY?: string
	ANTHROPIC_AUTH_TOKEN?: string
	ANTHROPIC_BASE_URL?: string
}

/** Variables can be extended */
export type Variables = SharedHonoVariables

export interface App extends HonoApp {
	Bindings: Env
	Variables: Variables
}
