import { ConvexError } from 'convex/values';

/** Server-thrown ConvexError messages are safe to show; anything else is generic. */
export const errorMessage = (error: unknown): string =>
    error instanceof ConvexError && typeof error.data === 'string'
        ? error.data
        : 'Something went wrong. Please try again.';
