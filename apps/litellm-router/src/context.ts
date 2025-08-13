import type { HonoApp } from '@repo/hono-helpers'
import type { SharedHonoEnv, SharedHonoVariables } from '@repo/hono-helpers/src/types'

export type Env = SharedHonoEnv & {
	// Container bindings (optional for basic testing)
	LITELLM_CONTAINER?: DurableObjectNamespace

	// BYOK Router Configuration
	CLOUDFLARE_AGENT_ROUTER_API_KEY?: string

	// Environment variables for LLM APIs (internal keys for premium mode)
	OPENAI_API_KEY?: string
	ANTHROPIC_API_KEY?: string
	OPENROUTER_API_KEY?: string
	GROQ_API_KEY?: string
	CEREBRAS_API_KEY?: string
	LITELLM_MASTER_KEY?: string
}

/** Variables can be extended */
export type Variables = SharedHonoVariables

export interface App extends HonoApp {
	Bindings: Env
	Variables: Variables
}
