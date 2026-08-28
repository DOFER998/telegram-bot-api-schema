import { parseFragment } from 'parse5';
import { type Element, isElement, type Node } from '../../html/dom.ts';
import { compareStrings } from '../../ordering.ts';

/** What a tag accepts, read off the samples that demonstrate it. */
export interface TagVocabulary {
  /** Attribute names the samples put on this tag, in alphabetical order. */
  readonly attributes: readonly string[];
  /**
   * Values the samples show, keyed by attribute name.
   *
   * A floor, not a closed set: the documentation demonstrates nine `tg-button`
   * types, it never declares there are nine.
   */
  readonly demonstrated_values?: Readonly<Record<string, readonly string[]>>;
}

/**
 * Attributes whose value selects a behaviour rather than carrying data.
 *
 * Named rather than inferred: "few distinct values, so it is an enumeration"
 * would turn a sample's two `src` URLs into the two legal values of `src`.
 */
const RECORDED: ReadonlySet<string> = new Set(['type', 'style', 'align', 'valign']);

/** Attributes written without a value, which are flags rather than empty strings. */
const FLAG = '';

/**
 * Reads which tags a syntax sample uses and what it puts on them.
 *
 * The samples are the only place the attribute vocabulary is stated. Every
 * element is walked, not only the ones opening a line: the same tag
 * demonstrated in two places contributes the union of what it carries.
 *
 * @param sample text of the `<pre>` block demonstrating the mode
 * @returns vocabulary keyed by tag name, in alphabetical order
 */
export function parseTagVocabulary(sample: string): Readonly<Record<string, TagVocabulary>> {
  const attributes = new Map<string, Map<string, Set<string>>>();

  for (const element of walk(parseFragment(sample).childNodes)) {
    const seen = attributes.get(element.tagName) ?? new Map<string, Set<string>>();
    attributes.set(element.tagName, seen);
    for (const attr of element.attrs) {
      const values = seen.get(attr.name) ?? new Set<string>();
      seen.set(attr.name, values);
      if (attr.value !== FLAG) {
        values.add(attr.value);
      }
    }
  }

  const vocabulary: Record<string, TagVocabulary> = {};
  for (const [tag, seen] of [...attributes].toSorted(([left], [right]) =>
    compareStrings(left, right),
  )) {
    const names = [...seen.keys()].toSorted(compareStrings);
    const values: Record<string, readonly string[]> = {};
    for (const name of names) {
      const found = seen.get(name);
      if (RECORDED.has(name) && found !== undefined && found.size > 0) {
        values[name] = [...found].toSorted(compareStrings);
      }
    }
    vocabulary[tag] = {
      attributes: names,
      ...(Object.keys(values).length === 0 ? {} : { demonstrated_values: values }),
    };
  }
  return vocabulary;
}

function* walk(nodes: readonly Node[]): Generator<Element> {
  for (const node of nodes) {
    if (!isElement(node)) {
      continue;
    }
    yield node;
    yield* walk(node.childNodes);
  }
}
