import { type Element, elementsOf } from '../html/dom.ts';
import { extractText } from '../html/text.ts';
import { headingAnchor } from './sections.ts';

/** Bot API version and the date it was released. */
export interface ApiRelease {
  /** The version, for example `10.3`. */
  readonly version: string;
  /** Release date formatted `YYYY-MM-DD`. */
  readonly release_date: string;
}

/** Anchor of the part that opens the page. */
export const RECENT_CHANGES = 'recent-changes';

const MONTHS: Readonly<Record<string, string>> = {
  January: '01',
  February: '02',
  March: '03',
  April: '04',
  May: '05',
  June: '06',
  July: '07',
  August: '08',
  September: '09',
  October: '10',
  November: '11',
  December: '12',
};

const RELEASE_DATE = /^([A-Z][a-z]+) (\d{1,2}), (\d{4})$/u;
const VERSION = /^Bot API (\d+(?:\.\d+)*)$/u;

/**
 * Reads the version and the release date from the first entry of Recent changes.
 *
 * @param content the documentation container
 * @throws when the part is missing or its first entry looks different
 */
export function parseRelease(content: Element): ApiRelease {
  const elements = elementsOf(content.childNodes);
  const changesAt = elements.findIndex(
    (element) => element.tagName === 'h3' && headingAnchor(element) === RECENT_CHANGES,
  );
  if (changesAt < 0) {
    throw new Error('The page has no Recent changes part — the documentation markup has changed');
  }

  const changes = elements.slice(changesAt + 1);
  const dateHeading = changes.find((element) => element.tagName === 'h4');
  if (dateHeading === undefined) {
    throw new Error('The Recent changes part holds no entries');
  }

  const versionParagraph = changes
    .slice(changes.indexOf(dateHeading) + 1)
    .find((element) => element.tagName === 'p');
  if (versionParagraph === undefined) {
    throw new Error('No paragraph with the Bot API version follows the date of the latest change');
  }

  return {
    version: parseVersion(extractText(versionParagraph.childNodes)),
    release_date: parseDocsDate(extractText(dateHeading.childNodes)),
  };
}

function parseVersion(text: string): string {
  const version = VERSION.exec(text)?.[1];
  if (version === undefined) {
    throw new Error(`Instead of a Bot API version the line under the date reads "${text}"`);
  }
  return version;
}

/**
 * Turns a date as the documentation writes it into an ISO one.
 *
 * @param text a date such as `August 24, 2026`
 * @returns `2026-08-24`
 * @throws when the date does not parse
 */
export function parseDocsDate(text: string): string {
  const parts = RELEASE_DATE.exec(text);
  const month = parts === null ? undefined : MONTHS[parts[1] ?? ''];
  if (parts === null || month === undefined) {
    throw new Error(`The date "${text}" could not be parsed`);
  }
  return `${parts[3]}-${month}-${(parts[2] ?? '').padStart(2, '0')}`;
}
