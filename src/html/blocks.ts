import { attribute, type Element, elementsNamed, elementsOf, isElement, type Node } from './dom.ts';
import { serializeHtml } from './serialize.ts';
import { extractText } from './text.ts';

/**
 * One block of documentation prose: a paragraph, a list, a code sample, a
 * quotation or a table.
 *
 * Three representations are kept side by side because the extractors need
 * different ones. Flat `text` is what a regular expression reads. `html` keeps
 * the emphasis and the `<code>` spans that mark up values — strip those and a
 * list of escapable characters becomes indistinguishable from a sentence about
 * them. `items` and `rows` are the structure a list or a table already has, so
 * that no extractor has to re-split text that was never flat to begin with.
 */
export interface DocsBlock {
  /** Lower-case tag name: `p`, `ul`, `ol`, `pre`, `blockquote`, `table`, `hr`, `div`. */
  readonly tag: string;
  /** The block as flat text. */
  readonly text: string;
  /** The block as normalised markup. */
  readonly html: string;
  /** Items of a list, in order. Absent for anything that is not a `ul` or an `ol`. */
  readonly items?: readonly string[];
  /** Markup of each list item, aligned with `items`. */
  readonly html_items?: readonly string[];
  /** Rows of a table including the header, in order. Absent for anything that is not a table. */
  readonly rows?: readonly (readonly string[])[];
}

const LIST_TAGS: ReadonlySet<string> = new Set(['ul', 'ol']);

/** Turns a run of nodes into blocks, dropping anything that is not an element. */
export function toBlocks(nodes: readonly Node[]): readonly DocsBlock[] {
  return elementsOf(nodes).map(toBlock);
}

/** Turns a single element into a block. */
export function toBlock(element: Element): DocsBlock {
  const base = {
    tag: element.tagName,
    // The element itself, not its children: a `<pre>` only keeps its line
    // breaks while the walk knows it is inside one.
    text: extractText([element]),
    html: serializeHtml([element]),
  };

  if (LIST_TAGS.has(element.tagName)) {
    const items = elementsNamed(element.childNodes, 'li');
    return {
      ...base,
      items: items.map((item) => extractText(item.childNodes)),
      html_items: items.map((item) => serializeHtml(item.childNodes)),
    };
  }

  if (element.tagName === 'table') {
    return { ...base, rows: tableRows(element) };
  }
  return base;
}

/**
 * Reads a table as rows of cell text, header included.
 *
 * The colour tables of the documentation have no `thead`, while the field
 * tables do, so both containers are walked and the rows come out in document
 * order either way.
 *
 * @param table the `<table>` element
 */
function tableRows(table: Element): readonly (readonly string[])[] {
  const containers = elementsOf(table.childNodes).filter(
    (element) => element.tagName === 'thead' || element.tagName === 'tbody',
  );
  const sources = containers.length > 0 ? containers : [table];
  return sources
    .flatMap((container) => elementsNamed(container.childNodes, 'tr'))
    .map((row) =>
      elementsOf(row.childNodes)
        .filter((cell) => cell.tagName === 'td' || cell.tagName === 'th')
        .map((cell) => extractText(cell.childNodes)),
    );
}

/**
 * Reads the anchor of a heading from the nested `<a class="anchor" name="...">`.
 *
 * @param heading an `h3`, `h4` or `h6` heading
 * @returns the anchor, or `undefined` when the heading carries none
 */
export function anchorOf(heading: Element): string | undefined {
  const link = elementsOf(heading.childNodes).find((child) => child.tagName === 'a');
  return link === undefined ? undefined : attribute(link, 'name');
}

/**
 * Tells whether a node is a heading of the given level.
 *
 * @param node node to test
 * @param tagName `h3`, `h4` or `h6`
 */
export function isHeading(node: Node, tagName: string): node is Element {
  return isElement(node) && node.tagName === tagName;
}
