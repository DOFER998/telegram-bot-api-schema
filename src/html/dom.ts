import { type DefaultTreeAdapterTypes, parse } from 'parse5';

/** Any node of a parsed document. */
export type Node = DefaultTreeAdapterTypes.Node;

/** An element node: tag, attributes, children. */
export type Element = DefaultTreeAdapterTypes.Element;

/** A text node. */
export type TextNode = DefaultTreeAdapterTypes.TextNode;

/** Root of a parsed document. */
export type Document = DefaultTreeAdapterTypes.Document;

/** Parses a whole HTML page. */
export function parseDocument(html: string): Document {
  return parse(html);
}

/** Tells whether a node is an element. */
export function isElement(node: Node): node is Element {
  return 'tagName' in node;
}

/** Tells whether a node is text. */
export function isText(node: Node): node is TextNode {
  return node.nodeName === '#text';
}

/** Picks the elements out of a node list, preserving order. */
export function elementsOf(nodes: readonly Node[]): Element[] {
  return nodes.filter(isElement);
}

/**
 * Picks the elements with the given tag. Does not descend.
 *
 * @param nodes nodes on one level
 * @param tagName lower-case tag name
 */
export function elementsNamed(nodes: readonly Node[], tagName: string): Element[] {
  return elementsOf(nodes).filter((element) => element.tagName === tagName);
}

/**
 * Finds the first element with the given tag. Does not descend.
 *
 * @param nodes nodes on one level
 * @param tagName lower-case tag name
 * @returns the element, or `undefined` when this level holds no such tag
 */
export function firstElementNamed(nodes: readonly Node[], tagName: string): Element | undefined {
  return elementsOf(nodes).find((element) => element.tagName === tagName);
}

/**
 * Reads an attribute value.
 *
 * @param name lower-case attribute name
 * @returns the value, or `undefined` when the attribute is absent
 */
export function attribute(element: Element, name: string): string | undefined {
  return element.attrs.find((attr) => attr.name === name)?.value;
}

/**
 * Searches a whole subtree for an element with the given `id`.
 *
 * @param root node the search starts from
 * @param id value of the `id` attribute
 * @returns the element, or `undefined` when the subtree holds no such `id`
 */
export function elementById(root: Node, id: string): Element | undefined {
  if (isElement(root) && attribute(root, 'id') === id) {
    return root;
  }
  if (!('childNodes' in root)) {
    return undefined;
  }
  for (const child of root.childNodes) {
    const found = elementById(child, id);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}
