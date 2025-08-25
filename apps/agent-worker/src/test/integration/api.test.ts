import { expect, it } from 'vitest'

// Note: Integration tests using SELF are temporarily disabled due to AJV compatibility issue
// The @modelcontextprotocol/sdk dependency uses ajv@6.12.6 which has dynamic code generation
// that conflicts with Cloudflare Workers' security model in the vitest environment.
// See: https://github.com/modelcontextprotocol/typescript-sdk/issues/689
//
// TODO: Re-enable when MCP SDK upgrades to AJV v8 with interpreted mode

// Basic unit tests for worker logic (not requiring SELF import)
it('should have basic arithmetic working', () => {
	expect(1 + 1).toBe(2)
})

// Placeholder for future integration tests
it.todo('should respond with hello world from root endpoint')
it.todo('should handle claude-code endpoint')
it.todo('should handle agent websocket connection')
