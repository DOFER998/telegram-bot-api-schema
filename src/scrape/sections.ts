import { anchorOf, isHeading } from '../html/blocks.ts';
import { type Element, isElement, type Node } from '../html/dom.ts';
import { extractText } from '../html/text.ts';

/** A documentation section: an `<h4>` heading and everything up to the next heading. */
export interface DocsSection {
  /** Anchor of the enclosing `<h3>` — the part the section belongs to. */
  readonly group: string;
  /** Heading of the section: for an entity this is the name of a type or a method. */
  readonly title: string;
  /** Anchor of the section. */
  readonly anchor: string;
  /** Nodes between this heading and the next heading of either level. */
  readonly nodes: readonly Node[];
}

/** The prose opening an `<h3>` part, before its first `<h4>`. */
export interface GroupSection {
  /** Anchor of the part. */
  readonly anchor: string;
  /** Heading of the part. */
  readonly title: string;
  /** Nodes between the heading and the first `<h4>`. */
  readonly nodes: readonly Node[];
}

/** Both levels of the page, cut apart. */
export interface SplitPage {
  /** The `<h4>` sections in page order. */
  readonly sections: readonly DocsSection[];
  /** The `<h3>` parts in page order. */
  readonly groups: readonly GroupSection[];
}

interface Draft {
  readonly group: string;
  readonly title: string;
  readonly anchor: string;
  readonly nodes: Node[];
}

/**
 * Cuts the contents of the page along its headings.
 *
 * An `<h3>` closes the open `<h4>` as surely as another `<h4>` does. Letting it
 * run on is what would make the prose that opens a part land on the last entity
 * of the part before it — `WebhookInfo` would carry the introduction to
 * available types, and every note attached to an entity would be suspect.
 *
 * @param content the documentation container
 * @returns sections and parts in page order
 */
export function splitPage(content: Element): SplitPage {
  const sections: Draft[] = [];
  const groups: Draft[] = [];
  let group = '';
  let open: Draft | undefined;

  for (const node of content.childNodes) {
    if (isHeading(node, 'h3')) {
      group = headingAnchor(node);
      open = { group, title: extractText(node.childNodes), anchor: group, nodes: [] };
      groups.push(open);
      continue;
    }
    if (isHeading(node, 'h4')) {
      open = { group, title: extractText(node.childNodes), anchor: headingAnchor(node), nodes: [] };
      sections.push(open);
      continue;
    }
    open?.nodes.push(node);
  }

  return { sections, groups };
}

/**
 * Reads the anchor of a heading.
 *
 * @param heading an `<h3>` or `<h4>` heading
 * @throws when the heading carries no anchor
 */
export function headingAnchor(heading: Element): string {
  const anchor = anchorOf(heading);
  if (anchor === undefined) {
    throw new Error(
      `Heading "${extractText(heading.childNodes)}" carries no anchor — the documentation markup has changed`,
    );
  }
  return anchor;
}

/**
 * Splits the nodes of a section along its `<h6>` subheadings.
 *
 * @param nodes nodes of the section
 * @returns the nodes above the first `<h6>`, and one run per subheading
 */
export function splitSubsections(nodes: readonly Node[]): {
  readonly lead: readonly Node[];
  readonly subsections: readonly { anchor: string; title: string; nodes: readonly Node[] }[];
} {
  const lead: Node[] = [];
  const subsections: { anchor: string; title: string; nodes: Node[] }[] = [];

  for (const node of nodes) {
    if (isElement(node) && node.tagName === 'h6') {
      subsections.push({
        anchor: headingAnchor(node),
        title: extractText(node.childNodes),
        nodes: [],
      });
      continue;
    }
    (subsections.at(-1)?.nodes ?? lead).push(node);
  }

  return { lead, subsections };
}
