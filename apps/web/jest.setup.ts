import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

if (!global.TextEncoder) {
	global.TextEncoder = TextEncoder as typeof global.TextEncoder;
}

if (!global.TextDecoder) {
	global.TextDecoder = TextDecoder as typeof global.TextDecoder;
}

// Suppress React testing-library act() warnings that are noisy in our CI logs.
// We still allow other console.error messages to surface.
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
	try {
		const first = args[0];
		const msg = typeof first === 'string' ? first : '';
		if (msg.includes('not wrapped in act') || msg.includes('An update to')) {
			return;
		}
	} catch {
		// fall through to original
	}
	// Call original console.error with unknown args without using `any`.
	(originalConsoleError as unknown as (...a: unknown[]) => void)(...args);
};
