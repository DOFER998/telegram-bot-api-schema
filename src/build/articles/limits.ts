import type { BotApiScrape, DocsArticle } from '../../schema/model.ts';

/** A size ceiling on a file sent one particular way. */
export interface FileSizeLimit {
  /** What the ceiling applies to. */
  readonly kind: 'photo' | 'other';
  /** The ceiling in megabytes. */
  readonly megabytes: number;
}

/** One way of putting a file into a message. */
export interface FileTransport {
  /** How the file is named: by identifier, by address, or by upload. */
  readonly by: 'file_id' | 'url' | 'multipart';
  /** What the documentation says about it. */
  readonly text: string;
  /** Size ceilings, where the documentation states them. */
  readonly limits?: readonly FileSizeLimit[];
  /** The rules attached to this way of sending, one per item. */
  readonly rules?: readonly string[];
}

/** Everything the documentation says about getting a file into a message. */
export interface SendingFiles {
  /** The three ways, in documentation order. */
  readonly transports: readonly FileTransport[];
}

/** A ceiling that is a plain number with a unit. */
export interface NumericLimit {
  /** The number. */
  readonly value: number;
  /** What it counts. */
  readonly unit: string;
  /** The sentence it was read from. */
  readonly text: string;
}

const SENDING_FILES = 'sending-files';
const RICH_LIMITS_ARTICLE = 'rich-message-formatting-options';
const RICH_LIMITS_SECTION = 'rich-message-limits';

const BY_ORDER: readonly FileTransport['by'][] = ['file_id', 'url', 'multipart'];

/** `5 MB max size for photos and 20 MB max for other types of content.` */
const PHOTO_LIMIT = /(\d+) MB max(?: size)? for photos/u;
const OTHER_LIMIT = /(\d+) MB (?:max )?for other/u;

const BY_HEADING: Readonly<Record<string, FileTransport['by']>> = {
  'Sending by file_id': 'file_id',
  'Sending by URL': 'url',
};

/** `Up to 32768 UTF-8 characters in the rich message text` */
const RICH_LIMIT = /^Up to ([\d\s]+) (.+?)[.,]?$/u;

/**
 * Reads the three ways of sending a file and the ceilings on each.
 *
 * The numbers — five megabytes for a photo by URL, fifty for anything else by
 * upload, one megabyte of `audio/ogg` for `sendVoice` — govern every call that
 * carries a file and appear nowhere near the methods that take one.
 *
 * @param scrape the parsed scrape
 * @returns the ways and their rules
 * @throws when the article is missing or no longer lists three ways
 */
export function buildSendingFiles(scrape: BotApiScrape): SendingFiles {
  const article = required(scrape, SENDING_FILES);

  const ways = article.blocks.find((block) => block.tag === 'ol')?.items ?? [];
  if (ways.length !== BY_ORDER.length) {
    throw new Error(
      `#${SENDING_FILES} lists ${ways.length} ways of sending a file, ${BY_ORDER.length} were expected`,
    );
  }

  const rules = headedLists(article);

  return {
    transports: ways.map((text, index) => {
      const by = BY_ORDER[index] ?? 'file_id';
      const limits = sizeLimits(text);
      const attached = rules[by];
      return {
        by,
        text,
        ...(limits.length === 0 ? {} : { limits }),
        ...(attached === undefined ? {} : { rules: attached }),
      };
    }),
  };
}

/**
 * Reads the ceilings of a rich message.
 *
 * @param scrape the parsed scrape
 * @returns one entry per ceiling
 * @throws when the section is missing or lists nothing
 */
export function buildRichLimits(scrape: BotApiScrape): readonly NumericLimit[] {
  const article = required(scrape, RICH_LIMITS_ARTICLE);
  const section = (article.subsections ?? []).find(
    (candidate) => candidate.anchor === RICH_LIMITS_SECTION,
  );
  if (section === undefined) {
    throw new Error(
      `The page has no #${RICH_LIMITS_SECTION} section — the documentation has changed`,
    );
  }

  const limits = (section.blocks.find((block) => block.tag === 'ul')?.items ?? []).flatMap(
    (item): NumericLimit[] => {
      const match = RICH_LIMIT.exec(item);
      if (match === null) {
        return [];
      }
      return [
        { value: Number((match[1] ?? '').replace(/\s/gu, '')), unit: match[2] ?? '', text: item },
      ];
    },
  );

  if (limits.length === 0) {
    throw new Error(`#${RICH_LIMITS_SECTION} no longer lists any limits`);
  }
  return limits;
}

function sizeLimits(text: string): readonly FileSizeLimit[] {
  const photo = PHOTO_LIMIT.exec(text);
  const other = OTHER_LIMIT.exec(text);
  return [
    ...(photo === null ? [] : [{ kind: 'photo' as const, megabytes: Number(photo[1]) }]),
    ...(other === null ? [] : [{ kind: 'other' as const, megabytes: Number(other[1]) }]),
  ];
}

/**
 * Pairs each "Sending by …" caption with the list of rules beneath it.
 *
 * The captions are plain paragraphs, so the pairing is positional: a list
 * belongs to the last caption seen above it.
 */
function headedLists(article: DocsArticle): Readonly<Record<string, readonly string[]>> {
  const collected: Record<string, readonly string[]> = {};
  let heading: FileTransport['by'] | undefined;

  for (const block of article.blocks) {
    const found = BY_HEADING[block.text];
    if (found !== undefined) {
      heading = found;
      continue;
    }
    if (heading !== undefined && block.tag === 'ul' && block.items !== undefined) {
      collected[heading] = block.items;
      heading = undefined;
    }
  }
  return collected;
}

function required(scrape: BotApiScrape, anchor: string): DocsArticle {
  const article = scrape.articles[anchor];
  if (article === undefined) {
    throw new Error(`The page has no #${anchor} section — the documentation has changed`);
  }
  return article;
}
