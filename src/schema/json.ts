import { compareStrings } from '../ordering.ts';

const INDENT = 2;

/**
 * Serialises a value into JSON fit for line-by-line comparison between runs.
 *
 * Object keys go in alphabetical order, the indent is two spaces, and the file
 * ends with a line break. Array order is documentation order, which carries
 * meaning and is left alone.
 *
 * @param value any JSON-compatible value
 * @returns contents of a machine-written JSON file
 */
export function serializeJson(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, INDENT)}\n`;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  const source = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(source).toSorted(compareStrings)) {
    sorted[key] = sortKeys(source[key]);
  }
  return sorted;
}
