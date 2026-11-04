// Form validation with no DOM, so node --test can run it.
import { fieldMessages, requiredFields, type FormVariant } from './constants.ts';

// ponytail: shape check only (something@something.tld); the inbox is the real test.
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Field name → error message for every invalid field, in field order. Empty when valid. */
export function validate(fields: Record<string, string | undefined>, variant: FormVariant): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const name of requiredFields[variant]) {
    const value = (fields[name] ?? '').trim();
    if (!value || (name === 'email' && !emailPattern.test(value))) errors[name] = fieldMessages[variant][name];
  }
  return errors;
}
