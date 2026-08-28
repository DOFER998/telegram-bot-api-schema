import type { BotApiScrape, DocsArticle, DocsSubsection } from '../../schema/model.ts';
import { type EscapingRules, parseEscaping } from './escaping.ts';
import {
  type CodeLanguage,
  type CustomEmoji,
  type MentionLink,
  parseCodeLanguage,
  parseCustomEmoji,
  parseMentionLink,
  parseSyntaxHighlighting,
  type SyntaxHighlighting,
} from './mentions.ts';
import { buildRich, type RichFormatting } from './rich.ts';
import { parseTagInventory, type TagAlias } from './tags.ts';
import { parseTagVocabulary, type TagVocabulary } from './vocabulary.ts';

/** One control character of the date-time format string. */
export interface DateTimeControl {
  /** The character itself. */
  readonly character: string;
  /** What it renders, in the words of the documentation. */
  readonly meaning: string;
}

/** The format string a date-time entity is rendered by. */
export interface DateTimeFormat {
  /** The regular expression a format string must match. */
  readonly pattern: string;
  /** What an empty format string means. */
  readonly empty: string;
  /** The control characters and what each renders. */
  readonly controls: readonly DateTimeControl[];
}

/** The four restrictions on nesting message entities. */
export interface EntityNesting {
  /** The sentence that introduces them. */
  readonly text: string;
  /** One restriction per item. */
  readonly rules: readonly string[];
}

/** One way of marking up a message. */
export interface ParseMode {
  /** Value of the `parse_mode` parameter that selects it. */
  readonly parse_mode: string;
  /** Anchor of the section describing it. */
  readonly anchor: string;
  /** Whether the documentation keeps it only for backward compatibility. */
  readonly legacy?: boolean;
  /** The syntax sample, verbatim and with its line breaks. */
  readonly syntax: string;
  /** The notes below the sample, one per item. */
  readonly notes: readonly string[];
  /** The escaping contract, for a mode that has one. */
  readonly escaping?: EscapingRules;
  /** Tags the mode accepts, grouped by what they produce. */
  readonly tags?: readonly TagAlias[];
  /** Distinct tag names the mode accepts. */
  readonly tag_names?: readonly string[];
  /** What each tag carries, and the values the sample shows for the attributes that select behaviour. */
  readonly vocabulary?: Readonly<Record<string, TagVocabulary>>;
  /** Named HTML entities the mode understands. */
  readonly named_entities?: readonly string[];
  /** Whether numeric HTML entities are understood. */
  readonly numeric_entities?: boolean;
  /** Whether entities may be nested in this mode. */
  readonly nesting_allowed?: boolean;
  /** Entity kinds the mode cannot express. */
  readonly unsupported_entities?: readonly string[];
  /** How the mode declares the language of a pre-formatted block. */
  readonly code_language?: CodeLanguage;
  /** What a custom emoji entity requires in this mode. */
  readonly custom_emoji?: CustomEmoji;
}

/** Everything the documentation says about marking up a message. */
export interface Formatting {
  /** The restrictions on nesting message entities. */
  readonly entity_nesting: EntityNesting;
  /** The format string of a date-time entity. */
  readonly date_time: DateTimeFormat;
  /** Mentioning a user by identifier rather than by username. */
  readonly mention_link: MentionLink;
  /** Where the list of languages a code block may declare is published. */
  readonly syntax_highlighting: SyntaxHighlighting;
  /** The parse modes, keyed by the value of `parse_mode` that selects them. */
  readonly modes: Readonly<Record<string, ParseMode>>;
  /** Rich messages, which are marked up in their own two modes and have their own vocabulary. */
  readonly rich: RichFormatting;
}

const FORMATTING_OPTIONS = 'formatting-options';

const MODE_SECTIONS: readonly { readonly anchor: string; readonly parse_mode: string }[] = [
  { anchor: 'markdownv2-style', parse_mode: 'MarkdownV2' },
  { anchor: 'html-style', parse_mode: 'HTML' },
  { anchor: 'markdown-style', parse_mode: 'Markdown' },
];

const HTML_MODES: ReadonlySet<string> = new Set(['HTML']);

const NESTING_INTRO = 'Message entities can be nested';
const NESTING_RULE = /^-\s+/u;

const DATE_TIME_ANCHOR = 'date-time-entity-formatting';
const DATE_TIME_PATTERN = /must adhere to the following regular expression: (.+?)\.$/u;
const DATE_TIME_CONTROL = /^(.): (.+)$/u;

const LEGACY = /^This is a legacy mode/u;
const NO_NESTING = /Entities must not be nested/u;
const NAMED_ENTITIES = /named HTML entities: ((?:<code>[^<]*<\/code>[,\s]*(?:and\s+)?)+)/u;
const NUMERIC_ENTITIES = /All numerical HTML entities are supported/u;
const UNSUPPORTED = /There is no way to specify ((?:“[^”]+”[,\s]*(?:and\s+)?)+) entities/u;
const CODE_SPAN = /<code>([^<]*)<\/code>/gu;
const QUOTED_VALUE = /“([^”]+)”/gu;

/**
 * Assembles the formatting section of the specification.
 *
 * None of this is in any published specification, and all of it is a contract:
 * the escape set of MarkdownV2, the tags HTML accepts and the four rules that
 * decide whether two entities may overlap are exactly what a client library has
 * to implement, and today each one implements them from a reading of the page.
 *
 * @param scrape the parsed scrape
 * @returns the formatting section
 * @throws when the article or a section it must contain is missing
 */
export function buildFormatting(scrape: BotApiScrape): Formatting {
  const article = scrape.articles[FORMATTING_OPTIONS];
  if (article === undefined) {
    throw new Error(
      `The page has no #${FORMATTING_OPTIONS} section — the documentation has changed`,
    );
  }

  return {
    entity_nesting: parseNesting(article),
    date_time: parseDateTime(subsection(article, DATE_TIME_ANCHOR)),
    mention_link: parseMentionLink(article),
    syntax_highlighting: parseSyntaxHighlighting(article),
    modes: Object.fromEntries(
      MODE_SECTIONS.map(({ anchor, parse_mode }) => [
        parse_mode,
        parseMode(subsection(article, anchor), parse_mode),
      ]),
    ),
    rich: buildRich(scrape),
  };
}

/**
 * Reads a parse-mode section into a mode.
 *
 * @param section the `<h6>` subsection describing the mode
 * @param parseMode value of `parse_mode` that selects it
 */
export function parseMode(section: DocsSubsection, parseMode: string): ParseMode {
  const intro = section.blocks.find((block) => block.tag === 'p')?.text ?? '';
  const syntax = section.blocks.find((block) => block.tag === 'pre')?.text ?? '';
  const noteList = section.blocks.findLast((block) => block.tag === 'ul');
  const notes = noteList?.items ?? [];
  const htmlNotes = noteList?.html_items ?? [];

  const tags = HTML_MODES.has(parseMode) ? parseTagInventory(syntax) : undefined;
  const escaping = parseEscaping(notes, htmlNotes);
  const codeLanguage = parseCodeLanguage(section, notes);
  const customEmoji = parseCustomEmoji(notes);

  return {
    parse_mode: parseMode,
    anchor: section.anchor,
    ...(LEGACY.test(intro) ? { legacy: true } : {}),
    syntax,
    notes,
    ...(escaping === undefined ? {} : { escaping }),
    ...(tags === undefined || tags.length === 0
      ? {}
      : { tags, tag_names: distinctTagNames(tags), vocabulary: parseTagVocabulary(syntax) }),
    ...namedEntities(htmlNotes),
    ...(notes.some((note) => NO_NESTING.test(note)) ? { nesting_allowed: false } : {}),
    ...unsupportedEntities(notes),
    ...(codeLanguage === undefined ? {} : { code_language: codeLanguage }),
    ...(customEmoji === undefined ? {} : { custom_emoji: customEmoji }),
  };
}

/**
 * The distinct tags of an inventory, in the order they first appear.
 *
 * A rich mode demonstrates the same tag several times with different attributes,
 * so the grouped inventory lists it more than once. A consumer checking whether
 * a tag is allowed wants the set, not the demonstrations.
 */
export function distinctTagNames(tags: readonly TagAlias[]): readonly string[] {
  return [...new Set(tags.flatMap((alias) => alias.tags.map((tag) => tag.name)))];
}

function namedEntities(htmlNotes: readonly string[]): {
  named_entities?: readonly string[];
  numeric_entities?: boolean;
} {
  const named = htmlNotes.map((note) => NAMED_ENTITIES.exec(note)).find((match) => match !== null);
  const numeric = htmlNotes.some((note) => NUMERIC_ENTITIES.test(note));

  if (named === null || named === undefined) {
    return numeric ? { numeric_entities: true } : {};
  }
  const entities = [...(named[1] ?? '').matchAll(CODE_SPAN)].map((match) =>
    decodeEntity(match[1] ?? ''),
  );
  return { named_entities: entities, ...(numeric ? { numeric_entities: true } : {}) };
}

const DECODED: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
};

/**
 * The markup writes `&amp;lt;` where the documentation means the entity `&lt;`.
 *
 * One pass, not a chain: decoding `&amp;lt;` to `&lt;` and then decoding that
 * again yields `<`, which is the character the entity stands for rather than the
 * entity the note is listing.
 */
function decodeEntity(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot);/gu, (entity) => DECODED[entity] ?? entity);
}

function unsupportedEntities(notes: readonly string[]): {
  unsupported_entities?: readonly string[];
} {
  const match = notes.map((note) => UNSUPPORTED.exec(note)).find((found) => found !== null);
  if (match === null || match === undefined) {
    return {};
  }
  return {
    unsupported_entities: [...(match[1] ?? '').matchAll(QUOTED_VALUE)].map(
      (found) => found[1] ?? '',
    ),
  };
}

function parseNesting(article: DocsArticle): EntityNesting {
  const block = article.blocks.find((candidate) => candidate.text.startsWith(NESTING_INTRO));
  if (block === undefined) {
    throw new Error('The formatting section no longer states the entity nesting restrictions');
  }
  const [intro = '', ...lines] = block.text.split('\n');
  const rules = lines
    .filter((line) => NESTING_RULE.test(line))
    .map((line) => line.replace(NESTING_RULE, ''));
  if (rules.length === 0) {
    throw new Error('The entity nesting restrictions are no longer written as a list');
  }
  return { text: intro, rules };
}

function parseDateTime(section: DocsSubsection): DateTimeFormat {
  const paragraphs = section.blocks.filter((block) => block.tag === 'p');
  const pattern = paragraphs
    .map((block) => DATE_TIME_PATTERN.exec(block.text))
    .find((match) => match !== null);
  if (pattern === null || pattern === undefined) {
    throw new Error('The date-time section no longer states the format-string expression');
  }

  const controls = (section.blocks.find((block) => block.tag === 'ul')?.items ?? []).flatMap(
    (item): DateTimeControl[] => {
      const match = DATE_TIME_CONTROL.exec(item);
      return match === null ? [] : [{ character: match[1] ?? '', meaning: match[2] ?? '' }];
    },
  );
  if (controls.length === 0) {
    throw new Error('The date-time section no longer lists its control characters');
  }

  return { pattern: pattern[1] ?? '', empty: paragraphs.at(1)?.text ?? '', controls };
}

function subsection(article: DocsArticle, anchor: string): DocsSubsection {
  const found = (article.subsections ?? []).find((section) => section.anchor === anchor);
  if (found === undefined) {
    throw new Error(`The page has no #${anchor} section — the documentation has changed`);
  }
  return found;
}
