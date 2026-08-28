import { parseFragment } from 'parse5';
import { type Element, elementsOf, isElement, isText, type Node } from '../../html/dom.ts';
import { extractText } from '../../html/text.ts';

/** One tag a parse mode accepts, with the attributes that select it. */
export interface TagShape {
  /** Tag name, for example `blockquote`. */
  readonly name: string;
  /** Attributes the sample pins down. An empty value is an attribute written without one. */
  readonly attributes?: Readonly<Record<string, string>>;
}

/** A run of tags that all produce the same thing. */
export interface TagAlias {
  /** What the tags produce, taken from the sample text: `bold`, `spoiler`. */
  readonly label: string;
  /** The interchangeable tags, in the order the documentation lists them. */
  readonly tags: readonly TagShape[];
}

/**
 * Reads the tag inventory out of an HTML-style syntax sample.
 *
 * One construct per line; comma-separated alternatives are aliases for the same
 * entity, as in `<b>bold</b>, <strong>bold</strong>`. Re-parsed as markup rather
 * than read with a pattern, so alternatives, attributes and nesting are
 * structure instead of guesswork.
 *
 * A line demonstrating nesting drops out on its own: its segments contain
 * elements and stop reading as aliases.
 *
 * @param sample text of the `<pre>` block
 * @returns alias groups in documentation order
 */
export function parseTagInventory(sample: string): readonly TagAlias[] {
  return sample
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .flatMap((line) => aliasesOf(line));
}

function aliasesOf(line: string): TagAlias[] {
  const nodes = parseFragment(line).childNodes;
  const elements = elementsOf(nodes);
  if (elements.length === 0 || hasNestedElements(elements) || hasStrayText(nodes)) {
    return [];
  }

  const labels = new Set(elements.map((element) => extractText(element.childNodes)));
  if (labels.size !== 1) {
    return [];
  }

  return [{ label: [...labels][0] ?? '', tags: elements.map(toShape) }];
}

/** A line that defines tags holds nothing between them but the separating comma. */
function hasStrayText(nodes: readonly Node[]): boolean {
  return nodes.some((node) => isText(node) && node.value.trim().replace(/,/gu, '').length > 0);
}

function hasNestedElements(elements: readonly Element[]): boolean {
  return elements.some((element) => element.childNodes.some(isElement));
}

function toShape(element: Element): TagShape {
  const attributes = Object.fromEntries(element.attrs.map((attr) => [attr.name, attr.value]));
  return {
    name: element.tagName,
    ...(Object.keys(attributes).length === 0 ? {} : { attributes }),
  };
}
