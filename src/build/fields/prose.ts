import type { ApiField } from '../../schema/model.ts';
import type { ConstantFact } from './model.ts';

/** `Returned only in getMe.` — the field is populated by exactly one method. */
const RETURNED_ONLY_IN = /\bReturned only in ([a-z][A-Za-z0-9]*)\b/gu;

/**
 * `For backward compatibility, when this field is set, the document field will
 * also be set.` — one field implies another, and a consumer that models them as
 * independent will write both or neither by accident.
 */
const IMPLIES_SET = /when this field is set, the ([a-z_]+) field will also be set/gu;

/** `But it has at most 52 significant bits` — the value does not fit an int32. */
const SIGNIFICANT_BITS = /\bat most (\d+) significant bits\b/u;

/** `Always 0.`, `Always 0 for crafted gifts.`, `Always False, unless …`. */
const ALWAYS =
  /\bAlways (“[^”]+”|-?\d+(?:\.\d+)?|True|False)(?:([,\s]+(?:for|if|unless|when|except)\b[^.]*))?/u;

/**
 * A run of quoted values is an enumeration: `“private”, “group”, “supergroup”
 * or “channel”`. Two or more of them separated by nothing but a comma or a
 * conjunction is the documentation listing a value set it never gave a name.
 */
const QUOTED_RUN = /“[^”]+”(?:(?:,\s*|\s+(?:or|and)\s+|,\s*(?:or|and)\s+)“[^”]+”)+/u;
const QUOTED_VALUE = /“([^”]+)”/gu;

/**
 * Reads the methods a field is only ever populated by.
 *
 * @param field the field or parameter
 * @returns the method names, or `undefined` when the field carries no such note
 */
export function parseReturnedOnlyIn(field: ApiField): readonly string[] | undefined {
  return collect(field.description, RETURNED_ONLY_IN);
}

/**
 * Reads the fields Telegram populates alongside this one.
 *
 * @param field the field or parameter
 * @returns the field names, or `undefined` when the field carries no such note
 */
export function parseImpliesSet(field: ApiField): readonly string[] | undefined {
  return collect(field.description, IMPLIES_SET);
}

/**
 * Reads the width warning attached to an identifier.
 *
 * @param field the field or parameter
 * @returns the number of significant bits, or `undefined` when unstated
 */
export function parseIntegerBits(field: ApiField): number | undefined {
  const match = SIGNIFICANT_BITS.exec(field.description);
  return match === null ? undefined : Number(match[1]);
}

/**
 * Reads a value the documentation pins down rather than describes.
 *
 * A qualifier is kept with the value — `Always 0 for crafted gifts` — because a
 * constant that only holds sometimes is not a constant.
 *
 * @param field the field or parameter
 * @returns the pinned value, or `undefined` when there is none
 */
export function parseConstant(field: ApiField): ConstantFact | undefined {
  const match = ALWAYS.exec(field.description);
  const literal = match?.[1];
  if (literal === undefined) {
    return undefined;
  }
  const condition = match?.[2]?.trim().replace(/^[,\s]+/u, '');
  return {
    value: toValue(literal),
    ...(condition === undefined || condition.length === 0 ? {} : { condition }),
  };
}

/**
 * Reads a value set the documentation enumerates in quotation marks.
 *
 * A run of quoted words is this field's value set only if the field could hold
 * one. Ten fields quote a run describing something else — which element types
 * the field applies to, which substrings a label replaces — and every one of
 * them is typed as something other than a string.
 *
 * @param field the field or parameter
 * @returns the values in documentation order, or `undefined` when there is no run
 */
export function parseOneOf(field: ApiField): readonly string[] | undefined {
  if (!field.types.some((type) => type === 'String' || type === 'Array of String')) {
    return undefined;
  }
  const run = QUOTED_RUN.exec(field.description)?.[0];
  if (run === undefined) {
    return undefined;
  }
  const values = [...new Set([...run.matchAll(QUOTED_VALUE)].map((match) => match[1] ?? ''))];
  return values.length < 2 ? undefined : values;
}

function collect(description: string, pattern: RegExp): readonly string[] | undefined {
  const found = [...new Set([...description.matchAll(pattern)].flatMap((match) => match[1] ?? []))];
  return found.length === 0 ? undefined : found;
}

function toValue(literal: string): string | number | boolean {
  if (literal.startsWith('“')) {
    return literal.slice(1, -1);
  }
  if (literal === 'True' || literal === 'False') {
    return literal === 'True';
  }
  return Number(literal);
}
