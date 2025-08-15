/**
 * Extract Bearer token from Authorization header
 * @param request - The incoming request
 * @returns The token string or null if not found
 */
export function extractAuthToken(request: Request): string | null {
	const authHeader = request.headers.get('Authorization')

	if (!authHeader) {
		return null
	}

	// Handle "Bearer <token>" format
	if (authHeader.startsWith('Bearer ')) {
		const token = authHeader.slice(7).trim()
		return token.length > 0 ? token : null
	}

	// Handle malformed "Bearer" without space or token
	if (authHeader.trim() === 'Bearer') {
		return null
	}

	// Handle direct token (no "Bearer " prefix)
	const trimmed = authHeader.trim()
	return trimmed.length > 0 ? trimmed : null
}
