import { attribute, isElement, isText, type Node } from './dom.ts';

/** Inside these, whitespace is content: a code sample is a grid of lines, not a sentence. */
const PREFORMATTED: ReadonlySet<string> = new Set(['pre']);

/**
 * Collapses any run of whitespace into a single space.
 *
 * Does not trim the edges: a space between inline tags carries meaning, and
 * trimming is only wanted around a complete description.
 *
 * @param text source text
 * @returns text without repeated whitespace
 */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/gu, ' ');
}

/**
 * Collects the flat text of a subtree.
 *
 * A `<br>` yields a line break and an `<img>` yields its `alt`, which is how
 * emoji reach the descriptions. Whitespace is normalised except inside `<pre>`,
 * where the line structure is the tag inventory.
 *
 * @param nodes nodes on one level
 * @returns text with whitespace normalised and the edges trimmed
 */
export function extractText(nodes: readonly Node[]): string {
  return collectText(nodes, false).join('').trim();
}

function collectText(nodes: readonly Node[], preformatted: boolean): string[] {
  return nodes.flatMap((node) => {
    if (isText(node)) {
      return [preformatted ? node.value : collapseWhitespace(node.value)];
    }
    if (!isElement(node)) {
      return [];
    }
    if (node.tagName === 'br') {
      return ['\n'];
    }
    if (node.tagName === 'img') {
      return [collapseWhitespace(attribute(node, 'alt') ?? '')];
    }
    return collectText(node.childNodes, preformatted || PREFORMATTED.has(node.tagName));
  });
}
