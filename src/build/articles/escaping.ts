/** A run of characters that must be escaped, and where the rule applies. */
export interface EscapeContext {
  /** Where the rule holds, in the words of the documentation. */
  readonly inside: string;
  /** The characters that must be escaped there. */
  readonly characters: readonly string[];
}

/**
 * How a sequence that could open two different entities is resolved.
 *
 * `__` opens an underline and also closes an italic, and MarkdownV2 settles it
 * greedily from the left. Two adjacent entities of those kinds therefore need a
 * separator that renders as nothing, which is what an empty bold entity is for.
 * A library that does not emit it produces text Telegram parses differently
 * from what the author wrote, with no error anywhere.
 */
export interface AmbiguityRule {
  /** The sequence that is ambiguous. */
  readonly sequence: string;
  /** What it is taken to mean. */
  readonly resolved_as: string;
  /** The sequence to insert between the two entities to force the other reading. */
  readonly separator: string;
  /** The sentence it was read from. */
  readonly text: string;
}

/** The complete escaping contract of a parse mode. */
export interface EscapingRules {
  /** The character that escapes the next one. */
  readonly escape_character: string;
  /** The range of character codes that may be escaped anywhere. */
  readonly escapable_codes?: { readonly from: number; readonly to: number };
  /** Characters that must be escaped wherever no narrower rule applies. */
  readonly always: readonly string[];
  /** Rules that replace the general one inside a particular construct. */
  readonly contexts?: readonly EscapeContext[];
  /** How a sequence that could open two different entities is resolved. */
  readonly ambiguity?: AmbiguityRule;
}

const ESCAPE_CHARACTER = '\\';

/** `Any character with code between 1 and 126 inclusively can be escaped anywhere` */
const CODE_RANGE = /character with code between (\d+) and (\d+) inclusively can be escaped/u;

/** `In all other places characters '_', '*', … must be escaped` */
const GENERAL = /In all other places characters ((?:'[^']*'(?:, )?)+) must be escaped/u;

/** `To escape characters '_', '*', '`', '[' outside of an entity, prepend` */
const LEGACY_GENERAL = /To escape characters ((?:'[^']*'(?:, )?)+) outside of an entity/u;

/** `Inside pre and code entities, all '`' and '\' characters must be escaped` */
const CONTEXT =
  /^Inside (.+?), all ((?:'[^']*'(?: and | ?, ?)?)+?)\s*(?:characters )?must be escaped/u;

const QUOTED = /'([^']*)'/gu;

/**
 * `In case of ambiguity between italic and underline entities __ is always
 * greedily treated from left to right as beginning or end of an underline
 * entity, so instead of ___italic underline___ use ___italic underline_**__,
 * adding an empty bold entity as a separator.`
 *
 * Read from the markup: the sequences are `<code>` spans, and flat text cannot
 * tell `__` the markup from `__` the prose.
 */
const AMBIGUITY =
  /In case of ambiguity between <code>([a-z]+)<\/code> and <code>([a-z]+)<\/code> entities <code>([^<]+)<\/code> is always greedily treated[^.]*?as beginning or end of an? <code>([a-z]+)<\/code> entity/u;

/** `use <code>___italic underline_**__</code>, adding an empty bold entity as a separator` */
const SEPARATOR = /use <code>_+[^<]*?_(\*+)_+<\/code>, adding an empty bold entity as a separator/u;

/**
 * Reads the escaping contract of a parse mode out of its notes.
 *
 * All four statements: the escape character, the range of codes that may be
 * escaped at all, the general set, and the narrower sets replacing it inside
 * code and inside the parenthesised half of a link.
 *
 * @param notes the note items of the parse-mode section, as flat text
 * @param htmlNotes the same items as markup, where marked-up sequences survive
 * @returns the rules, or `undefined` when the notes state no general set
 */
export function parseEscaping(
  notes: readonly string[],
  htmlNotes: readonly string[] = [],
): EscapingRules | undefined {
  const general = notes
    .map((note) => GENERAL.exec(note) ?? LEGACY_GENERAL.exec(note))
    .find((match) => match !== null);
  if (general === undefined || general === null) {
    return undefined;
  }

  const codes = notes.map((note) => CODE_RANGE.exec(note)).find((match) => match !== null);
  const contexts = notes.flatMap((note): EscapeContext[] => {
    const match = CONTEXT.exec(note);
    const characters = match === null ? [] : quoted(match[2] ?? '');
    return match === null || characters.length === 0
      ? []
      : [{ inside: (match[1] ?? '').trim(), characters }];
  });

  const ambiguity = parseAmbiguity(htmlNotes);

  return {
    escape_character: ESCAPE_CHARACTER,
    ...(codes === null || codes === undefined
      ? {}
      : { escapable_codes: { from: Number(codes[1]), to: Number(codes[2]) } }),
    always: quoted(general[1] ?? ''),
    ...(contexts.length === 0 ? {} : { contexts }),
    ...(ambiguity === undefined ? {} : { ambiguity }),
  };
}

function parseAmbiguity(htmlNotes: readonly string[]): AmbiguityRule | undefined {
  const at = htmlNotes.findIndex((note) => AMBIGUITY.test(note));
  if (at < 0) {
    return undefined;
  }
  const note = htmlNotes[at] ?? '';
  const match = AMBIGUITY.exec(note);
  const separator = SEPARATOR.exec(note)?.[1];
  if (match === null || separator === undefined) {
    throw new Error(
      'MarkdownV2 states the italic/underline ambiguity but no longer names the separator that resolves it',
    );
  }
  return {
    sequence: match[3] ?? '',
    resolved_as: match[4] ?? '',
    separator,
    text: note.replace(/<[^>]+>/gu, ''),
  };
}

function quoted(text: string): readonly string[] {
  return [...new Set([...text.matchAll(QUOTED)].map((match) => match[1] ?? ''))].filter(
    (value) => value.length > 0,
  );
}
