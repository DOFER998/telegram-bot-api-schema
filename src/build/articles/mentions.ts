import type { DocsArticle, DocsSubsection } from '../../schema/model.ts';

/** Mentioning a user by identifier rather than by username. */
export interface MentionLink {
  /** The scheme, as the documentation writes it. */
  readonly scheme: string;
  /** The conditions under which such a link works at all. */
  readonly rules: readonly string[];
}

/** Where the list of languages a code block may declare is published. */
export interface SyntaxHighlighting {
  /** Address of the list. */
  readonly languages_url: string;
}

/** How a parse mode declares the language of a pre-formatted block. */
export interface CodeLanguage {
  /** The nesting that carries the declaration. */
  readonly via: string;
  /** Prefix of the class name that names the language. */
  readonly class_prefix: string;
  /** Whether a standalone code tag can declare a language. It cannot. */
  readonly standalone_supported: boolean;
}

/** What a custom emoji entity needs and who may send one. */
export interface CustomEmoji {
  /** Whether a plain emoji must be supplied to stand in where the custom one cannot render. */
  readonly fallback_required: boolean;
  /** The sentence saying which bots may use them, whose conditions are prose. */
  readonly availability: string;
}

/** `Links tg://user?id=<user_id> can be used to mention a user` */
const MENTION_SCHEME = /Links (tg:\/\/user\?id=<[a-z_]+>) can be used to mention/u;

/** The list of languages lives behind a link, so the address survives only in the markup. */
const LANGUAGES_LINK = /syntax highlighting is supported at <a href="([^"]+)"/u;

/** `Use nested pre and code tags, to define programming language for pre entity.` */
const NESTED_CODE = /Use nested ([a-z]+) and ([a-z]+) tags,? to define programming language/u;

/** `Programming language can't be specified for standalone code tags.` */
const STANDALONE = /Programming language can't be specified for standalone/u;

/**
 * The sample names the class it uses: `<code class="language-python">`.
 *
 * Anchored on the tag. An unanchored pattern finds `class="tg-spoiler"` higher
 * up the same sample and reports `tg-` as the prefix that names a language.
 */
const LANGUAGE_CLASS = /<code class="([a-z]+-)[a-z]+"/u;

/** `A valid emoji must be provided as an alternative value` / `must be used as the content` */
const FALLBACK = /A valid emoji must be (?:provided|used)/u;

/** `Custom emoji entities can only be used by bots that …` */
const AVAILABILITY = /^Custom emoji entities can only be used by .*$/u;

/**
 * Reads the rules for mentioning a user by identifier.
 *
 * `tg://user?id=` is the only way to address a user who has no username, and it
 * works in exactly two places. A library that offers it without the two
 * conditions produces links that render as plain text in a message body and
 * nobody can tell why.
 *
 * @param article the formatting article
 * @returns the scheme and its conditions
 * @throws when the article no longer states them
 */
export function parseMentionLink(article: DocsArticle): MentionLink {
  const at = article.blocks.findIndex((block) => MENTION_SCHEME.test(block.text));
  const scheme = at < 0 ? undefined : MENTION_SCHEME.exec(article.blocks[at]?.text ?? '')?.[1];
  const rules = article.blocks.slice(at + 1).find((block) => block.items !== undefined)?.items;

  if (scheme === undefined || rules === undefined || rules.length === 0) {
    throw new Error('The formatting section no longer states the rules for tg://user?id= links');
  }
  return { scheme, rules };
}

/**
 * Reads where the list of highlightable languages is published.
 *
 * @param article the formatting article
 * @throws when the link is gone
 */
export function parseSyntaxHighlighting(article: DocsArticle): SyntaxHighlighting {
  const url = article.blocks
    .map((block) => LANGUAGES_LINK.exec(block.html))
    .find((match) => match !== null);
  if (url === null || url === undefined) {
    throw new Error('The formatting section no longer links the list of highlightable languages');
  }
  return { languages_url: url[1] ?? '' };
}

/**
 * Reads how a mode declares the language of a code block.
 *
 * @param section the parse-mode subsection
 * @param notes the note items of that subsection
 * @returns the rule, or `undefined` when the mode states none
 */
export function parseCodeLanguage(
  section: DocsSubsection,
  notes: readonly string[],
): CodeLanguage | undefined {
  const nested = notes.map((note) => NESTED_CODE.exec(note)).find((match) => match !== null);
  if (nested === null || nested === undefined) {
    return undefined;
  }
  const sample = section.blocks.find((block) => block.tag === 'pre')?.text ?? '';
  return {
    via: `${nested[1]} > ${nested[2]}`,
    class_prefix: LANGUAGE_CLASS.exec(sample)?.[1] ?? '',
    standalone_supported: !notes.some((note) => STANDALONE.test(note)),
  };
}

/**
 * Reads what a custom emoji entity requires.
 *
 * @param notes the note items of a parse-mode subsection
 * @returns the requirements, or `undefined` when the mode does not support them
 */
export function parseCustomEmoji(notes: readonly string[]): CustomEmoji | undefined {
  const availability = notes.find((note) => AVAILABILITY.test(note));
  if (availability === undefined) {
    return undefined;
  }
  return {
    fallback_required: notes.some((note) => FALLBACK.test(note)),
    availability,
  };
}
