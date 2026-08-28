import type { ApiField } from '../../schema/model.ts';
import type { Alphabet } from './model.ts';

/** The numeric bounds and the default a description spells out. */
export interface Bounds {
  readonly min?: number;
  readonly max?: number;
  readonly min_length?: number;
  readonly max_length?: number;
  readonly default?: string | number | boolean;
  readonly default_type?: string;
  readonly alphabet?: Alphabet;
}

/**
 * A length is always written as a range immediately before the word
 * `characters`: "1-4096 characters after entities parsing", "1-32 characters".
 */
const LENGTH = /\b(\d+)-(\d+) characters\b/u;

/**
 * Numeric bounds come in three phrasings and no more. Each is anchored on words
 * that only ever introduce a bound, so a range that happens to sit in a sentence
 * about something else cannot be mistaken for one.
 */
const RANGES: readonly RegExp[] = [
  /\bValues between (\d+)-(\d+) are accepted\b/u,
  /\b[Mm]ust be between (\d+) and (\d+)\b/u,
  /[;,] (\d+)-(\d+)\. Defaults to\b/u,
];

/** `Defaults to 100.`, `Defaults to “image/jpeg”.`, `Defaults to False,`. */
const DEFAULT = /\bDefaults to (?:“([^”]+)”|(-?\d+(?:\.\d+)?)|(True|False))(?=[.,\s]|$)/u;

/**
 * `Defaults to BotCommandScopeDefault.` — the default is a whole object, and the
 * documentation names its type rather than writing the object out.
 */
const DEFAULT_TYPE = /\bDefaults to ([A-Z][A-Za-z0-9]*)(?=[.,\s]|$)/u;

/** The alphabet is marked up with `<code>` spans, one per range or character. */
const ALPHABET = /Only characters ((?:<code>[^<]*<\/code>[,\s]*(?:and\s+)?)+)are allowed/u;
const CODE_SPAN = /<code>([^<]*)<\/code>/gu;
const RANGE_SHAPE = /^.-.$/u;

/**
 * Reads the bounds a field description states in prose.
 *
 * Lengths are taken out of the text before the numeric ranges are looked for.
 * "0-1024 characters" and "Values between 1-100 are accepted" are the same shape
 * to a regular expression, and reading a length as a numeric bound would put a
 * caption's character limit on the value of the caption itself.
 *
 * @param field the field or parameter
 * @returns the bounds it states; every key is absent when it states none
 */
export function parseBounds(field: ApiField): Bounds {
  const length = LENGTH.exec(field.description);
  const withoutLength = field.description.replace(LENGTH, ' ');

  const range = RANGES.map((pattern) => pattern.exec(withoutLength)).find(
    (match) => match !== null,
  );
  const fallback = parseDefault(withoutLength);
  const fallbackType = fallback === undefined ? DEFAULT_TYPE.exec(withoutLength)?.[1] : undefined;
  const alphabet = parseAlphabet(field.html_description);

  return {
    ...(range === null || range === undefined
      ? {}
      : { min: Number(range[1]), max: Number(range[2]) }),
    ...(length === null ? {} : { min_length: Number(length[1]), max_length: Number(length[2]) }),
    ...(fallback === undefined ? {} : { default: fallback }),
    ...(fallbackType === undefined ? {} : { default_type: fallbackType }),
    ...(alphabet === undefined ? {} : { alphabet }),
  };
}

function parseDefault(description: string): string | number | boolean | undefined {
  const match = DEFAULT.exec(description);
  if (match === null) {
    return undefined;
  }
  if (match[1] !== undefined) {
    return match[1];
  }
  if (match[2] !== undefined) {
    return Number(match[2]);
  }
  return match[3] === 'True';
}

/**
 * Reads the characters a value is restricted to.
 *
 * The list only survives in the markup: `A-Z`, `a-z`, `0-9`, `_` and `-` are
 * each their own `<code>` span, and flat text turns them into a sentence where
 * a range and a hyphen are the same character.
 */
function parseAlphabet(html: string): Alphabet | undefined {
  const match = ALPHABET.exec(html);
  if (match === null) {
    return undefined;
  }
  const spans = [...(match[1] ?? '').matchAll(CODE_SPAN)].map((span) => span[1] ?? '');
  const ranges = spans.filter((span) => RANGE_SHAPE.test(span));
  const characters = spans.filter((span) => span.length === 1);
  return ranges.length + characters.length === spans.length && spans.length > 0
    ? { ranges, characters }
    : undefined;
}
