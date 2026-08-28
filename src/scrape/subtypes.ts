import { attribute, type Element, elementsNamed, elementsOf, type Node } from '../html/dom.ts';
import { extractText } from '../html/text.ts';

/**
 * Reads the list of subtypes of an abstract type.
 *
 * An abstract type has no field table: below its description sits a list whose
 * every item is a single link to another type of the specification. A list with
 * even one item shaped differently has nothing to do with subtypes.
 *
 * @param nodes nodes of the type section
 * @param knownTypes names of every type in the specification
 * @returns names of the subtypes, or `undefined` when the type is not abstract
 */
export function parseSubtypes(
  nodes: readonly Node[],
  knownTypes: ReadonlySet<string>,
): readonly string[] | undefined {
  for (const list of elementsOf(nodes).filter((element) => element.tagName === 'ul')) {
    const items = elementsNamed(list.childNodes, 'li').map((item) =>
      linkedTypeName(item, knownTypes),
    );
    const names = items.filter((name) => name !== undefined);
    if (names.length > 0 && names.length === items.length) {
      return names;
    }
  }
  return undefined;
}

function linkedTypeName(item: Element, knownTypes: ReadonlySet<string>): string | undefined {
  const children = elementsOf(item.childNodes);
  const link = children.at(0);
  if (children.length !== 1 || link === undefined || link.tagName !== 'a') {
    return undefined;
  }
  const name = extractText(item.childNodes);
  const pointsToType = attribute(link, 'href') === `#${name.toLowerCase()}`;
  return pointsToType && knownTypes.has(name) ? name : undefined;
}
