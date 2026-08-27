/**
 * The floor for an admin password, in one place because it was previously written out
 * four times and had already drifted: login accepted eight characters while every path
 * that *set* a password demanded ten, so a password could be created that could not be
 * changed to itself.
 *
 * Admin sign-in has no second factor by design, so this length is the whole gate.
 * Raising it is safe; lowering it is a deliberate security decision.
 */
export const ADMIN_PASSWORD_MIN_LENGTH = 8;
export const ADMIN_PASSWORD_MAX_LENGTH = 128;
