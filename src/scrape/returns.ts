/** Scalar types the documentation names directly in prose. */
const PRIMITIVES: ReadonlySet<string> = new Set([
  'Boolean',
  'False',
  'Float',
  'Int',
  'Integer',
  'String',
  'True',
]);

interface ReturnPattern {
  readonly pattern: RegExp;
  readonly array: boolean;
}

/**
 * Phrasings of a return value that occur in the documentation.
 *
 * The filler `[^.!?]*?` keeps a match from crossing a sentence boundary:
 * neighbouring phrases such as "Returns the list of gifts that can be sent by
 * the bot" would otherwise glue onto the real return value in the next
 * sentence. The order matters — among matches starting at the same position the
 * pattern listed first wins.
 */
const PATTERNS: readonly ReturnPattern[] = [
  { pattern: /\b[Rr]eturns?\s+(?:an?\s+|the\s+)?Array\s+of\s+([A-Z][A-Za-z0-9]*)/gu, array: true },
  { pattern: /\ban?\s+Array\s+of\s+([A-Z][A-Za-z0-9]*)[^.!?]*?\bis\s+returned\b/gu, array: true },
  { pattern: /\b[Rr]eturns?\s+[^.!?]*?\bas\s+(?:an?\s+)?([A-Z][A-Za-z0-9]*)\b/gu, array: false },
  { pattern: /\b[Rr]eturns?\s+[^.!?]*?\b([A-Z][A-Za-z0-9]*)\s+objects?\b/gu, array: false },
  {
    pattern: /\b[Rr]eturns?\s+[^.!?]*?\b([A-Z][A-Za-z0-9]*)\b[^.!?]*?\bon\s+success\b/gu,
    array: false,
  },
  { pattern: /\b([A-Z][A-Za-z0-9]*)\s+(?:objects?\s+)?is\s+returned\b/gu, array: false },
];

interface Candidate {
  readonly at: number;
  readonly order: number;
  readonly type: string;
}

/**
 * Reads the return type of a method out of the prose of its description.
 *
 * A captured name must be a known type or a scalar, which is what makes
 * "Returns the score of the specified user" drop out on its own. Prose no
 * pattern matches yields nothing; whether that is a defect is decided by the
 * stage that can see the declarations.
 *
 * @param description method description as flat text
 * @param knownTypes names of every type in the documentation
 * @returns return types in the vocabulary of the documentation, or `undefined`
 */
export function parseReturns(
  description: string,
  knownTypes: ReadonlySet<string>,
): readonly string[] | undefined {
  const earliest = candidates(description, knownTypes).toSorted(
    (left, right) => left.at - right.at || left.order - right.order,
  );
  const found = earliest.at(0);
  return found === undefined ? undefined : [found.type];
}

function candidates(description: string, knownTypes: ReadonlySet<string>): Candidate[] {
  return PATTERNS.flatMap(({ pattern, array }, order) =>
    [...description.matchAll(pattern)].flatMap((match) => {
      const name = match[1];
      if (name === undefined || !(PRIMITIVES.has(name) || knownTypes.has(name))) {
        return [];
      }
      return [{ at: match.index, order, type: array ? `Array of ${name}` : name }];
    }),
  );
}
