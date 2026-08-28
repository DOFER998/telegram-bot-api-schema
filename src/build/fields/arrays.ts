import type { ApiField } from '../../schema/model.ts';

/** Bounds on the number of elements of an array-typed field. */
export interface ItemBounds {
  readonly min_items?: number;
  readonly max_items?: number;
}

const ARRAY_PREFIX = 'Array of ';

/**
 * An element count is always introduced by the word for the collection:
 * "a list of 1-100 identifiers", "must include 2-10 items", "List of 1-3
 * additional colors".
 *
 * The introducer is what keeps a range apart from a number that merely looks
 * like one. `Giveaway.country_codes` speaks of "ISO 3166-1 alpha-2 country
 * codes", and an unanchored range reads that standard as a bound of 3166 to 1.
 */
const ITEM_RANGE = /\b(?:[Ll]ist of|[Aa]rray of|must include)\s+(\d+)-(\d+)\s/u;

/** "List of up to 100 winners", "in up to 4 sizes each", "up to 10 items". */
const ITEM_MAX = /\bup to (\d+) (?!characters\b)[a-z]/u;

/**
 * Reads how many elements an array-typed field accepts.
 *
 * Only fields whose type column already says `Array of` are looked at. The same
 * phrasings occur in descriptions of scalars — "up to 1000 messages per second"
 * on `allow_paid_broadcast` is a rate, not a length — and the type column is the
 * only thing that tells the two apart without guessing.
 *
 * @param field the field or parameter
 * @returns the element bounds; every key is absent when the field states none
 */
export function parseItemBounds(field: ApiField): ItemBounds {
  if (!field.types.some((type) => type.startsWith(ARRAY_PREFIX))) {
    return {};
  }

  const range = ITEM_RANGE.exec(field.description);
  if (range !== null) {
    return { min_items: Number(range[1]), max_items: Number(range[2]) };
  }

  const max = ITEM_MAX.exec(field.description);
  return max === null ? {} : { max_items: Number(max[1]) };
}
