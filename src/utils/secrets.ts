/**
 * Secret Detection and Redaction
 */

import { SECRET_PATTERNS } from '../config';

export interface RedactionResult {
  redactedText: string;
  secretsFound: string[];
}

/**
 * Redact secrets from a string
 */
export function redactSecrets(text: string): RedactionResult {
  let redactedText = text;
  const secretsFound: string[] = [];

  for (const { name, pattern, replacement } of SECRET_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      secretsFound.push(`${name} (${matches.length} occurrence${matches.length > 1 ? 's' : ''})`);
      redactedText = redactedText.replace(pattern, replacement);
    }
  }

  return { redactedText, secretsFound };
}

/**
 * Redact secrets from an object recursively
 */
export function redactObjectSecrets(obj: unknown): { redacted: unknown; secretsFound: string[] } {
  const allSecretsFound: string[] = [];

  function redactValue(value: unknown): unknown {
    if (typeof value === 'string') {
      const { redactedText, secretsFound } = redactSecrets(value);
      allSecretsFound.push(...secretsFound);
      return redactedText;
    }

    if (Array.isArray(value)) {
      return value.map(redactValue);
    }

    if (value !== null && typeof value === 'object') {
      const redactedObj: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        redactedObj[key] = redactValue(val);
      }
      return redactedObj;
    }

    return value;
  }

  const redacted = redactValue(obj);
  // Deduplicate secrets found
  const uniqueSecrets = [...new Set(allSecretsFound)];

  return { redacted, secretsFound: uniqueSecrets };
}

/**
 * Check if a string contains potential secrets
 */
export function containsSecrets(text: string): boolean {
  for (const { pattern } of SECRET_PATTERNS) {
    if (pattern.test(text)) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;
      return true;
    }
    pattern.lastIndex = 0;
  }
  return false;
}
