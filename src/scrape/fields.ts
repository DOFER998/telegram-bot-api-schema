import { type Element, elementsNamed, type Node } from '../html/dom.ts';
import { serializeHtml } from '../html/serialize.ts';
import { extractText } from '../html/text.ts';
import type { ApiField } from '../schema/model.ts';

/** Kind of table: fields of a type or parameters of a method. They differ by their header. */
export type TableKind = 'fields' | 'parameters';

/** A parsed documentation table. */
export interface ParsedTable {
  /** Kind of table, decided by the header. */
  readonly kind: TableKind;
  /** Rows in documentation order. */
  readonly rows: readonly ApiField[];
}

const HEADERS: Readonly<Record<TableKind, readonly string[]>> = {
  fields: ['Field', 'Type', 'Description'],
  parameters: ['Parameter', 'Type', 'Required', 'Description'],
};

const OPTIONAL_PREFIX = 'Optional. ';
const TYPE_SEPARATOR = ' or ';
const ARRAY_PREFIX = 'Array of ';

/**
 * A type column listing several element types writes them as an English list:
 * `Array of InputMediaAudio, InputMediaDocument and InputMediaVideo`. Splitting
 * on `or` alone leaves that as one string, which names no type a consumer can
 * resolve.
 */
const LIST_SEPARATOR = /,\s+|\s+and\s+/u;

/**
 * Parses a documentation table.
 *
 * @param table the `<table>` element
 * @param owner name of the type or method — it goes into the error text
 * @throws when the header or the cell count of a row is not what was expected
 */
export function parseTable(table: Element, owner: string): ParsedTable {
  const head = elementsNamed(table.childNodes, 'thead').at(0);
  const body = elementsNamed(table.childNodes, 'tbody').at(0);
  if (head === undefined || body === undefined) {
    throw new Error(`${owner}: the table has no thead or no tbody`);
  }

  const headerRow = elementsNamed(head.childNodes, 'tr').at(0);
  if (headerRow === undefined) {
    throw new Error(`${owner}: the table header is empty`);
  }

  const kind = detectKind(
    elementsNamed(headerRow.childNodes, 'th').map((cell) => extractText(cell.childNodes)),
    owner,
  );
  return {
    kind,
    rows: elementsNamed(body.childNodes, 'tr').map((row) => parseRow(row, kind, owner)),
  };
}

function detectKind(header: readonly string[], owner: string): TableKind {
  const kind = (Object.keys(HEADERS) as TableKind[]).find((candidate) =>
    sameStrings(HEADERS[candidate], header),
  );
  if (kind === undefined) {
    throw new Error(`${owner}: unfamiliar table header [${header.join(', ')}]`);
  }
  return kind;
}

function parseRow(row: Element, kind: TableKind, owner: string): ApiField {
  const cells = elementsNamed(row.childNodes, 'td').map((cell) => cell.childNodes);
  const expected = HEADERS[kind].length;
  if (cells.length !== expected) {
    throw new Error(`${owner}: a table row holds ${cells.length} cells, ${expected} were expected`);
  }

  const [nameCell = [], typeCell = [], thirdCell = [], fourthCell = []] = cells;
  const descriptionCell: readonly Node[] = kind === 'fields' ? thirdCell : fourthCell;
  const description = extractText(descriptionCell);

  return {
    name: extractText(nameCell),
    types: parseTypes(extractText(typeCell)),
    required:
      kind === 'fields'
        ? !description.startsWith(OPTIONAL_PREFIX)
        : parseRequired(extractText(thirdCell), owner),
    description,
    html_description: serializeHtml(descriptionCell),
  };
}

/**
 * Splits a type column into the types it names.
 *
 * Alternatives are written with `or`; the element types of an array are written
 * as a list, and the `Array of` in front of that list governs every one of them.
 * Distributing the prefix is what turns a sentence back into a set of types.
 *
 * @param cell text of the type column
 * @returns the types it names, in the order it names them
 */
export function parseTypes(cell: string): readonly string[] {
  return cell.split(TYPE_SEPARATOR).flatMap((alternative) => {
    if (!alternative.startsWith(ARRAY_PREFIX)) {
      return [alternative];
    }
    const elements = alternative.slice(ARRAY_PREFIX.length).split(LIST_SEPARATOR);
    return elements.map((element) => `${ARRAY_PREFIX}${element}`);
  });
}

function parseRequired(value: string, owner: string): boolean {
  if (value === 'Yes') {
    return true;
  }
  if (value === 'Optional') {
    return false;
  }
  throw new Error(`${owner}: the Required column reads "${value}", expected "Yes" or "Optional"`);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
