/**
 * Compares strings by UTF-16 code unit.
 *
 * `localeCompare` depends on the locale and the ICU version. The order of keys
 * in the file CI watches for Bot API drift must not depend on the environment.
 *
 * @param first left string
 * @param second right string
 * @returns -1, 0 or 1
 */
export function compareStrings(first: string, second: string): number {
  if (first < second) {
    return -1;
  }
  return first > second ? 1 : 0;
}
