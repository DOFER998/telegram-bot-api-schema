import { type Element, elementsOf, firstElementNamed, type Node } from '../html/dom.ts';
import { serializeHtml } from '../html/serialize.ts';
import { extractText } from '../html/text.ts';
import type { ApiField, ApiMethod, ApiType } from '../schema/model.ts';
import { type ParsedTable, parseTable, type TableKind } from './fields.ts';
import { parseNotes } from './notes.ts';
import { parseReturns } from './returns.ts';
import type { DocsSection } from './sections.ts';
import { parseSubtypes } from './subtypes.ts';
import { RECENT_CHANGES } from './version.ts';

const ENTITY_NAME = /^[A-Za-z][A-Za-z0-9]*$/u;
const TYPE_NAME = /^[A-Z]/u;

const TABLE_LABEL: Readonly<Record<TableKind, string>> = {
  fields: 'fields of a type',
  parameters: 'parameters of a method',
};

interface Described {
  readonly description: string;
  readonly html_description: string;
}

/**
 * Tells an entity section apart from a prose one.
 *
 * Articles such as "Sending files" and "Formatting options" sit in the same
 * parts of the page as the entities and differ only by having a heading of
 * several words. Changelog entries are headed by dates and drop out along with
 * their part.
 *
 * @param section a section of the page
 */
export function isEntitySection(section: DocsSection): boolean {
  return section.group !== RECENT_CHANGES && ENTITY_NAME.test(section.title);
}

/** Tells a type section from a method section: types are named with a capital letter. */
export function isTypeSection(section: DocsSection): boolean {
  return TYPE_NAME.test(section.title);
}

/** Assembles a type from its section. */
export function parseType(section: DocsSection, knownTypes: ReadonlySet<string>): ApiType {
  const fields = tableRows(section, 'fields');
  const subtypes = parseSubtypes(section.nodes, knownTypes);
  const notes = parseNotes(section.nodes);

  return {
    name: section.title,
    anchor: section.anchor,
    ...parseDescription(section.nodes),
    ...(fields === undefined ? {} : { fields }),
    ...(subtypes === undefined ? {} : { subtypes }),
    ...(notes === undefined ? {} : { notes }),
  };
}

/** Assembles a method from its section. */
export function parseMethod(section: DocsSection, knownTypes: ReadonlySet<string>): ApiMethod {
  const parameters = tableRows(section, 'parameters');
  const described = parseDescription(section.nodes);
  const returns = parseReturns(described.description, knownTypes);
  const notes = parseNotes(section.nodes);

  return {
    name: section.title,
    anchor: section.anchor,
    ...described,
    ...(returns === undefined ? {} : { returns }),
    ...(parameters === undefined ? {} : { parameters }),
    ...(notes === undefined ? {} : { notes }),
  };
}

function tableRows(section: DocsSection, expected: TableKind): readonly ApiField[] | undefined {
  const table = firstElementNamed(section.nodes, 'table');
  return table === undefined
    ? undefined
    : requireKind(parseTable(table, section.title), expected, section.title);
}

function requireKind(table: ParsedTable, expected: TableKind, owner: string): readonly ApiField[] {
  if (table.kind !== expected) {
    throw new Error(
      `${owner}: found a table of ${TABLE_LABEL[table.kind]}, expected a table of ${TABLE_LABEL[expected]}`,
    );
  }
  return table.rows;
}

function parseDescription(nodes: readonly Node[]): Described {
  const paragraphs = leadingParagraphs(nodes);
  return {
    description: paragraphs.map((paragraph) => extractText(paragraph.childNodes)).join('\n\n'),
    html_description: paragraphs.map((paragraph) => serializeHtml([paragraph])).join('\n'),
  };
}

/**
 * The paragraphs of a description are everything above the table or the subtype list.
 *
 * What sits below is a note: it does not describe the entity, and letting it in
 * would put "This method will not work if an outgoing webhook is set up" into
 * the text a return type is parsed out of.
 */
function leadingParagraphs(nodes: readonly Node[]): Element[] {
  const elements = elementsOf(nodes);
  const stop = elements.findIndex(
    (element) => element.tagName === 'table' || element.tagName === 'ul',
  );
  const head = stop < 0 ? elements : elements.slice(0, stop);
  return head.filter((element) => element.tagName === 'p');
}
