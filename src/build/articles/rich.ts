import type { BotApiScrape, DocsArticle, DocsSubsection } from '../../schema/model.ts';
import { buildRichLimits, type NumericLimit } from './limits.ts';
import { parseTagInventory, type TagAlias } from './tags.ts';
import { parseTagVocabulary, type TagVocabulary } from './vocabulary.ts';

/** A link scheme that names an already uploaded file instead of an HTTP address. */
export interface UploadLink {
  /** The scheme as the documentation writes it, for example `tg://photo?id=`. */
  readonly scheme: string;
  /** What the identifier names. */
  readonly kind: string;
}

/** One way of writing a rich message. */
export interface RichMode {
  /** Field of `InputRichMessage` the content goes in: `markdown` or `html`. */
  readonly field: string;
  /** Anchor of the section describing it. */
  readonly anchor: string;
  /** The syntax samples, verbatim and with their line breaks. */
  readonly samples: readonly string[];
  /** Tags the samples demonstrate, grouped by what they produce. */
  readonly tags?: readonly TagAlias[];
  /** Distinct tag names the samples demonstrate. */
  readonly tag_names: readonly string[];
  /** What each tag carries, and the values the samples show for the attributes that select behaviour. */
  readonly vocabulary: Readonly<Record<string, TagVocabulary>>;
  /** Tags usable only while streaming a draft. */
  readonly draft_only_tags?: readonly string[];
  /** Named HTML entities the mode understands. */
  readonly named_entities?: readonly string[];
  /** Whether numeric HTML entities are understood. */
  readonly numeric_entities?: boolean;
  /** The notes below the samples, one per item. */
  readonly notes: readonly string[];
}

/** Everything the documentation says about rich messages. */
export interface RichFormatting {
  /** Anchor of the section. */
  readonly anchor: string;
  /** Entity kinds Telegram finds in the text without being asked. */
  readonly auto_detected_entities: readonly string[];
  /** The field that turns automatic detection off. */
  readonly skip_entity_detection: string;
  /** Schemes naming an already uploaded file. */
  readonly upload_links: readonly UploadLink[];
  /** Ceilings on a rich message. */
  readonly limits: readonly NumericLimit[];
  /** The modes, keyed by the field of `InputRichMessage` they are written in. */
  readonly modes: Readonly<Record<string, RichMode>>;
}

const ARTICLE = 'rich-message-formatting-options';

const MODE_SECTIONS: readonly { readonly anchor: string; readonly field: string }[] = [
  { anchor: 'rich-markdown-style', field: 'markdown' },
  { anchor: 'rich-html-style', field: 'html' },
];

/**
 * `Plain URLs, e-mail addresses, username mentions, hashtags, cashtags, bot
 * commands, phone numbers, and bank card numbers are detected automatically.`
 */
const AUTO_DETECTED = /^(.+?) are detected automatically\./u;

/** `To disable automatic entity detection, pass True in the skip_entity_detection field.` */
const SKIP_DETECTION = /pass True in the ([a-z_]+) field/u;

/** `you can use links in the form tg://photo?id=..., tg://video?id=..., …` */
const UPLOAD_LINK = /tg:\/\/([a-z]+)\?id=/gu;

/** `Additionally, you can use the following tag in sendRichMessageDraft:` */
const DRAFT_ONLY = /you can use the following tags? in ([A-Za-z]+)/u;

const NAMED_ENTITIES = /named HTML entities: ((?:<code>[^<]*<\/code>[,\s]*(?:and\s+)?)+)/u;
const NUMERIC_ENTITIES = /All numerical HTML entities are supported/u;
const CODE_SPAN = /<code>([^<]*)<\/code>/gu;
const TAG_NAME = /<([a-z][a-z0-9-]*)/u;

const DECODED: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
};

/**
 * Assembles the rich-message section.
 *
 * The largest block of prose on the page: a vocabulary of about sixty tags,
 * buttons with nine kinds and four styles, table and list attributes, thirteen
 * named entities, and five ceilings.
 *
 * @param scrape the parsed scrape
 * @returns the rich-message section
 * @throws when the article or a section it must contain is missing
 */
export function buildRich(scrape: BotApiScrape): RichFormatting {
  const article = scrape.articles[ARTICLE];
  if (article === undefined) {
    throw new Error(`The page has no #${ARTICLE} section — the documentation has changed`);
  }

  return {
    anchor: article.anchor,
    auto_detected_entities: autoDetected(article),
    skip_entity_detection: skipField(article),
    upload_links: uploadLinks(article),
    limits: buildRichLimits(scrape),
    modes: Object.fromEntries(
      MODE_SECTIONS.map(({ anchor, field }) => [
        field,
        parseRichMode(subsection(article, anchor), field),
      ]),
    ),
  };
}

/**
 * Reads one rich mode.
 *
 * A rich section carries several samples rather than one: the Markdown mode
 * shows its own syntax, then the HTML tags for what Markdown cannot express,
 * then the tag that only works in a draft. All of them are the mode, so all of
 * them are kept and the vocabulary is read across the lot.
 */
function parseRichMode(section: DocsSubsection, field: string): RichMode {
  const samples = section.blocks.filter((block) => block.tag === 'pre').map((block) => block.text);
  const noteList = section.blocks.findLast((block) => block.tag === 'ul');
  const notes = noteList?.items ?? [];
  const htmlNotes = noteList?.html_items ?? [];

  const joined = samples.join('\n');
  const vocabulary = parseTagVocabulary(joined);
  const tags = parseTagInventory(joined);

  return {
    field,
    anchor: section.anchor,
    samples,
    ...(tags.length === 0 ? {} : { tags }),
    tag_names: Object.keys(vocabulary),
    vocabulary,
    ...draftOnly(section),
    ...namedEntities(htmlNotes),
    notes,
  };
}

/**
 * Reads the tags the documentation marks as usable only while streaming a draft.
 *
 * `tg-thinking` renders a placeholder and only `sendRichMessageDraft` accepts
 * it. Nothing in the tag inventory says so — the restriction lives in the
 * sentence above the sample, and losing it means a library offers a tag that
 * fails on every ordinary send.
 */
function draftOnly(section: DocsSubsection): { draft_only_tags?: readonly string[] } {
  const at = section.blocks.findIndex((block) => DRAFT_ONLY.test(block.text));
  if (at < 0) {
    return {};
  }
  const sample = section.blocks.slice(at + 1).find((block) => block.tag === 'pre');
  const tag = sample === undefined ? undefined : TAG_NAME.exec(sample.text)?.[1];
  return tag === undefined ? {} : { draft_only_tags: [tag] };
}

function autoDetected(article: DocsArticle): readonly string[] {
  const match = article.blocks
    .map((block) => AUTO_DETECTED.exec(block.text))
    .find((found) => found !== null);
  if (match === null || match === undefined) {
    throw new Error(`#${ARTICLE} no longer lists the automatically detected entities`);
  }
  return (match[1] ?? '')
    .split(/,\s*(?:and\s+)?|\s+and\s+/u)
    .map((entity) => entity.trim())
    .filter((entity) => entity.length > 0);
}

function skipField(article: DocsArticle): string {
  const match = article.blocks
    .map((block) => SKIP_DETECTION.exec(block.text))
    .find((found) => found !== null);
  if (match === null || match === undefined) {
    throw new Error(`#${ARTICLE} no longer names the field that disables entity detection`);
  }
  return match[1] ?? '';
}

function uploadLinks(article: DocsArticle): readonly UploadLink[] {
  const found = article.blocks.flatMap((block) => [...block.text.matchAll(UPLOAD_LINK)]);
  const kinds = [...new Set(found.map((match) => match[1] ?? ''))];
  if (kinds.length === 0) {
    throw new Error(`#${ARTICLE} no longer lists the tg:// links that name an uploaded file`);
  }
  return kinds.map((kind) => ({ scheme: `tg://${kind}?id=`, kind }));
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

/** One pass: `&amp;lt;` is the entity `&lt;`, not the character it stands for. */
function decodeEntity(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot);/gu, (entity) => DECODED[entity] ?? entity);
}

function subsection(article: DocsArticle, anchor: string): DocsSubsection {
  const found = (article.subsections ?? []).find((section) => section.anchor === anchor);
  if (found === undefined) {
    throw new Error(`The page has no #${anchor} section — the documentation has changed`);
  }
  return found;
}
