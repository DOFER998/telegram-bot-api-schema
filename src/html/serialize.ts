import { compareStrings } from '../ordering.ts';
import { type Element, isElement, isText, type Node } from './dom.ts';
import { collapseWhitespace } from './text.ts';

const VOID_TAGS: ReadonlySet<string> = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

const IN_TEXT = /[&<>]/gu;
const IN_ATTRIBUTE = /[&<>"]/gu;

/** Inside these, whitespace is content and must survive normalisation. */
const PREFORMATTED: ReadonlySet<string> = new Set(['pre']);

/**
 * Prints a subtree back into HTML in a normalised form.
 *
 * The markup of the page lands in `schema.json` and gets compared between runs,
 * so nothing of the original spelling may survive: attributes go in alphabetical
 * order, values are always double-quoted, entities are reduced to `&amp;`,
 * `&lt;`, `&gt;` and `&quot;`, and void tags are closed with a slash.
 *
 * @param nodes nodes on one level
 * @returns HTML with the edges trimmed
 */
export function serializeHtml(nodes: readonly Node[]): string {
  return nodes
    .map((node) => printNode(node, false))
    .join('')
    .trim();
}

function printNode(node: Node, preformatted: boolean): string {
  if (isText(node)) {
    return escapeText(preformatted ? node.value : collapseWhitespace(node.value), IN_TEXT);
  }
  return isElement(node) ? printElement(node, preformatted) : '';
}

function printElement(element: Element, preformatted: boolean): string {
  const attrs = element.attrs
    .toSorted((left, right) => compareStrings(left.name, right.name))
    .map((attr) => ` ${attr.name}="${escapeText(attr.value, IN_ATTRIBUTE)}"`)
    .join('');

  if (VOID_TAGS.has(element.tagName)) {
    return `<${element.tagName}${attrs}/>`;
  }
  const inside = preformatted || PREFORMATTED.has(element.tagName);
  const children = element.childNodes.map((child) => printNode(child, inside)).join('');
  return `<${element.tagName}${attrs}>${children}</${element.tagName}>`;
}

function escapeText(text: string, pattern: RegExp): string {
  return text.replace(pattern, (character) => ESCAPES[character] ?? character);
}
