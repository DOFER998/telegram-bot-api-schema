import { toBlock } from '../html/blocks.ts';
import { type Element, elementsOf, type Node } from '../html/dom.ts';
import { extractText } from '../html/text.ts';
import type { ApiNote } from '../schema/model.ts';

/** A table of fields ends the description; a subtype list does the same for an abstract type. */
const ENDS_DESCRIPTION: ReadonlySet<string> = new Set(['table', 'ul']);

/** Only these carry prose. A `div` around an illustration does not. */
const CARRIES_PROSE: ReadonlySet<string> = new Set(['p', 'blockquote']);

/**
 * The page signs off after its last entity with a rule and a farewell. Nothing
 * past that rule belongs to `GameHighScore`, which merely happens to be last.
 */
const ENDS_SECTION = 'hr';

const NUMBERED_LINE = /^\d+\.\s+/u;

/**
 * Collects the prose an entity carries outside its table.
 *
 * A paragraph above the table is the description, not a note. A quotation above
 * it is a note: the documentation is calling out something the description
 * deliberately does not say.
 *
 * @param nodes nodes of the entity section
 * @returns notes in document order, or `undefined` when the entity carries none
 */
export function parseNotes(nodes: readonly Node[]): readonly ApiNote[] | undefined {
  const all = elementsOf(nodes);
  const ruleAt = all.findIndex((element) => element.tagName === ENDS_SECTION);
  const elements = ruleAt < 0 ? all : all.slice(0, ruleAt);
  const tableAt = elements.findIndex((element) => ENDS_DESCRIPTION.has(element.tagName));

  const notes = elements.flatMap((element, index): ApiNote[] => {
    if (!CARRIES_PROSE.has(element.tagName)) {
      return [];
    }
    const position = tableAt >= 0 && index > tableAt ? 'after_table' : 'before_table';
    if (position === 'before_table' && element.tagName === 'p') {
      return [];
    }

    const block = toBlock(element);
    const items = numberedItems(element);
    return [
      {
        position,
        tag: block.tag,
        text: block.text,
        html: block.html,
        ...(items === undefined ? {} : { items }),
      },
    ];
  });

  return notes.length === 0 ? undefined : notes;
}

/**
 * Splits a note the documentation numbers by hand into its items.
 *
 * `setWebhook` writes three notes as one paragraph with `<strong>N.</strong>`
 * markers and `<br>` between them — a list in every sense except the markup.
 *
 * @param element the note element
 * @returns the items, or `undefined` when the note is not a hand-numbered list
 */
function numberedItems(element: Element): readonly string[] | undefined {
  const paragraphs =
    element.tagName === 'blockquote'
      ? elementsOf(element.childNodes).filter((child) => child.tagName === 'p')
      : [element];

  const items = paragraphs.flatMap((paragraph) =>
    extractText(paragraph.childNodes)
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => NUMBERED_LINE.test(line)),
  );

  return items.length < 2 ? undefined : items.map((line) => line.replace(NUMBERED_LINE, ''));
}
