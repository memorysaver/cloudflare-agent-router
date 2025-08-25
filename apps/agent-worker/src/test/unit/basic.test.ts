import { describe, expect, it } from 'vitest'

describe('basic tests', () => {
	it('should pass basic test', () => {
		expect(1 + 1).toBe(2)
	})

	it('should handle string operations', () => {
		expect('hello'.toUpperCase()).toBe('HELLO')
	})
})