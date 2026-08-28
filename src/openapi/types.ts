import type { FieldFacts } from '../build/fields/model.ts';
import type { Spec } from '../build/spec.ts';

/** A JSON Schema as OpenAPI 3.1 uses it. Loose on purpose: the document is data, not a model. */
export type JsonSchema = Record<string, unknown>;

const ARRAY_PREFIX = 'Array of ';

/**
 * Scalars of the documentation and what each is in JSON Schema.
 *
 * `True` and `False` mark a value that can only ever be what its name says.
 * They are recorded as an extension rather than as `const`, which would be the
 * literal JSON Schema spelling: two generators turn a boolean `const` into a
 * single-member enum backed by an int or a string and emit code that does not
 * compile. Removing it takes the C# client from 338 errors to 64.
 *
 * Nothing is lost by that. The same fact reaches a field through
 * `x-telegram-boolean.type_column`, and this extension carries it everywhere
 * else — on a return type, for instance, which has no field to hang it on.
 */
const SCALARS: Readonly<Record<string, JsonSchema>> = {
  Integer: { type: 'integer' },
  Int: { type: 'integer' },
  Float: { type: 'number' },
  'Float number': { type: 'number' },
  String: { type: 'string' },
  Boolean: { type: 'boolean' },
  True: { type: 'boolean', 'x-telegram-always': true },
  False: { type: 'boolean', 'x-telegram-always': false },
};

/**
 * The one type the documentation describes in prose and never as a table.
 *
 * OpenAPI says an uploaded file is a string with `binary` format. The other half
 * of the mechanism — naming an attached file from inside a JSON parameter with
 * `attach://` — has no OpenAPI spelling at all and is carried as an extension on
 * the operation.
 */
const INPUT_FILE = 'InputFile';

/** Identifiers the documentation warns may exceed 32 bits. */
const WIDE_INTEGER_BITS = 32;

/**
 * Turns a type as the documentation writes it into a schema.
 *
 * @param declared the type, for example `Integer` or `Array of Message`
 * @returns the schema for it
 */
export function schemaForType(declared: string): JsonSchema {
  if (declared.startsWith(ARRAY_PREFIX)) {
    return { type: 'array', items: schemaForType(declared.slice(ARRAY_PREFIX.length)) };
  }
  if (declared === INPUT_FILE) {
    return { type: 'string', format: 'binary' };
  }
  const scalar = SCALARS[declared];
  return scalar === undefined ? { $ref: `#/components/schemas/${declared}` } : { ...scalar };
}

/**
 * Turns the type column of a field into a schema.
 *
 * A column naming several types becomes `oneOf`. A column naming one becomes
 * that one, unwrapped: wrapping a single alternative would make every generator
 * emit a needless union.
 *
 * @param declared the types the column names
 * @returns the schema for the column
 */
export function schemaForColumn(declared: readonly string[]): JsonSchema {
  const schemas = declared.map(schemaForType);
  const [only] = schemas;
  if (schemas.length === 1 && only !== undefined) {
    return only;
  }

  // `Integer or String` is one value that may be either, not a choice between
  // two shapes. JSON Schema 2020-12 says that with a list of types, and OpenAPI
  // 3.1 is built on it. Spelling it as `oneOf` instead makes generators emit a
  // wrapper class per occurrence — `chat_id` alone would produce forty of them,
  // and the TypeScript generator's wrappers do not compile.
  const scalars = schemas.filter(isPlainScalar);
  if (scalars.length === schemas.length) {
    return { type: scalars.map((schema) => schema.type as string) };
  }

  // `InputFile or String` is one string that may be an upload, a file
  // identifier or a URL. Every alternative is a string, so the type is a
  // string, and which of the three it is stays on the field as an extension —
  // OpenAPI has no way to say it, and `oneOf` over two strings says nothing a
  // generator can use.
  if (schemas.every((schema) => schema.type === 'string')) {
    return { type: 'string', 'x-telegram-string-forms': declared };
  }
  return { oneOf: schemas };
}

/**
 * A scalar with no constraint on it beyond its type.
 *
 * An extension is not a constraint, so a `True` still counts as a plain boolean
 * and can join a list of types.
 */
function isPlainScalar(schema: JsonSchema): boolean {
  const keys = Object.keys(schema).filter((key) => !key.startsWith('x-'));
  return keys.length === 1 && keys[0] === 'type' && typeof schema.type === 'string';
}

/**
 * What an enum of the specification refers to, if any field is typed by it.
 *
 * @param spec the specification
 * @returns the enum name that types each `Entity.field`, where one does
 */
export function enumsBySite(spec: Spec): Readonly<Record<string, string>> {
  const sites: Record<string, string> = {};
  for (const item of Object.values(spec.enums)) {
    for (const site of item.applies_to ?? []) {
      sites[site] = item.name;
    }
  }
  return sites;
}

/** Keywords a field's extracted facts contribute to its schema, and which facts they used. */
export interface AppliedFacts {
  /** The JSON Schema keywords. */
  readonly keywords: JsonSchema;
  /** Names of the facts that became keywords. */
  readonly standard: readonly string[];
  /** Names of the facts that became `x-` extensions. */
  readonly extended: readonly string[];
  /** The extensions themselves. */
  readonly extensions: JsonSchema;
}

/**
 * Turns the facts extracted from a field's prose into schema keywords.
 *
 * Everything JSON Schema has a word for becomes that word. Everything else
 * becomes an extension rather than being dropped — the three kinds of boolean,
 * the methods a field is only returned by, the fields it implies, the meaning
 * behind a plain `Integer`.
 *
 * @param facts what the prose of the field stated
 * @returns the keywords, the extensions, and what went where
 */
export function applyFacts(facts: FieldFacts | undefined): AppliedFacts {
  if (facts === undefined) {
    return { keywords: {}, standard: [], extended: [], extensions: {} };
  }

  const bounds = boundsOf(facts);
  const values = valuesOf(facts);
  const extras = extrasOf(facts);

  return {
    keywords: { ...bounds.keywords, ...values.keywords },
    extensions: { ...values.extensions, ...extras.extensions },
    standard: [...bounds.standard, ...values.standard],
    extended: [...values.extended, ...extras.extended],
  };
}

/** Facts JSON Schema already has a keyword for, one to one. */
const BOUNDS: readonly (readonly [keyof FieldFacts, string])[] = [
  ['min', 'minimum'],
  ['max', 'maximum'],
  ['min_length', 'minLength'],
  ['max_length', 'maxLength'],
  ['min_items', 'minItems'],
  ['max_items', 'maxItems'],
  ['default', 'default'],
  ['one_of', 'enum'],
];

function boundsOf(facts: FieldFacts): { keywords: JsonSchema; standard: string[] } {
  const keywords: JsonSchema = {};
  const standard: string[] = [];
  for (const [fact, keyword] of BOUNDS) {
    const value = facts[fact];
    if (value !== undefined) {
      keywords[keyword] = value;
      standard.push(fact);
    }
  }
  return { keywords, standard };
}

/**
 * Facts whose keyword depends on what the fact says.
 *
 * A value that only holds under a condition is not a constant, and an integer
 * that fits in 32 bits needs no format — writing either as though it were
 * unconditional would state more than the documentation does.
 */
function valuesOf(facts: FieldFacts): {
  keywords: JsonSchema;
  extensions: JsonSchema;
  standard: string[];
  extended: string[];
} {
  const keywords: JsonSchema = {};
  const extensions: JsonSchema = {};
  const standard: string[] = [];
  const extended: string[] = [];

  if (facts.constant !== undefined) {
    if (facts.constant.condition === undefined) {
      keywords['const'] = facts.constant.value;
      standard.push('constant');
    } else {
      extensions['x-telegram-constant'] = facts.constant;
      extended.push('constant');
    }
  }

  if (facts.alphabet !== undefined) {
    keywords['pattern'] = patternFor(facts.alphabet);
    standard.push('alphabet');
  }

  if (facts.integer_bits !== undefined) {
    if (facts.integer_bits > WIDE_INTEGER_BITS) {
      keywords['format'] = 'int64';
      standard.push('integer_bits');
    } else {
      extensions['x-telegram-integer-bits'] = facts.integer_bits;
      extended.push('integer_bits');
    }
  }

  return { keywords, extensions, standard, extended };
}

/** Facts OpenAPI has no word for at all. */
const EXTRAS: readonly (readonly [keyof FieldFacts, string])[] = [
  ['default_type', 'x-telegram-default-type'],
  ['boolean', 'x-telegram-boolean'],
  ['returned_only_in', 'x-telegram-returned-only-in'],
  ['implies_set', 'x-telegram-implies-set'],
  ['semantic', 'x-telegram-semantic'],
];

function extrasOf(facts: FieldFacts): { extensions: JsonSchema; extended: string[] } {
  const extensions: JsonSchema = {};
  const extended: string[] = [];
  for (const [fact, key] of EXTRAS) {
    const value = facts[fact];
    if (value !== undefined) {
      extensions[key] = value;
      extended.push(fact);
    }
  }
  return { extensions, extended };
}

/**
 * Turns an allowed alphabet into an anchored pattern.
 *
 * `-` goes last inside the character class, where it is a literal rather than a
 * range; putting it anywhere else silently widens the pattern.
 */
function patternFor(alphabet: {
  ranges: readonly string[];
  characters: readonly string[];
}): string {
  const ordered = [...alphabet.characters].toSorted((left, right) =>
    left === '-' ? 1 : right === '-' ? -1 : 0,
  );
  return `^[${[...alphabet.ranges, ...ordered].join('')}]*$`;
}
