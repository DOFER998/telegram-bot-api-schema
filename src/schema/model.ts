import type { DocsBlock } from '../html/blocks.ts';

/**
 * A field of a type or a parameter of a method: in the documentation these are
 * rows of tables of the same shape.
 *
 * The description is kept in two representations. Flat text is for reading and
 * for parsing prose; the source HTML is kept because values are marked up with
 * emphasis (`<em>typing</em>`) or `<code>` and are indistinguishable from the
 * rest of the text once the tags are gone.
 */
export interface ApiField {
  /** Name of the field or parameter. */
  readonly name: string;
  /** Types in the vocabulary of the documentation: `Integer`, `Array of Message`. */
  readonly types: readonly string[];
  /** Whether it is required: the `Required` column for methods, an `Optional.` prefix for types. */
  readonly required: boolean;
  /** Description as flat text. */
  readonly description: string;
  /** Description as source markup. */
  readonly html_description: string;
}

/**
 * A block of prose that belongs to an entity but sits outside its table.
 *
 * The documentation attaches them either above the table or below it, and the
 * position carries meaning: below sits what the reader needs after knowing the
 * parameters, above sits what they need before.
 */
export interface ApiNote {
  /** Where the block sits relative to the table. */
  readonly position: 'before_table' | 'after_table';
  /** Tag of the block: `p` for a plain paragraph, `blockquote` for a called-out one. */
  readonly tag: string;
  /** The block as flat text. */
  readonly text: string;
  /** The block as normalised markup. */
  readonly html: string;
  /** The numbered items, where the block is a numbered list rendered with `<strong>N.</strong>`. */
  readonly items?: readonly string[];
}

/** A Bot API type. */
export interface ApiType {
  /** Name of the type. */
  readonly name: string;
  /** Anchor of the section on the documentation page. */
  readonly anchor: string;
  /** Description as flat text. */
  readonly description: string;
  /** Description as source markup. */
  readonly html_description: string;
  /** Fields in documentation order. Absent for types without a table. */
  readonly fields?: readonly ApiField[];
  /** Subtypes of an abstract type. Absent for every other type. */
  readonly subtypes?: readonly string[];
  /** Prose attached to the type but outside its table. Absent when there is none. */
  readonly notes?: readonly ApiNote[];
}

/** A Bot API method. */
export interface ApiMethod {
  /** Name of the method. */
  readonly name: string;
  /** Anchor of the section on the documentation page. */
  readonly anchor: string;
  /** Description as flat text. */
  readonly description: string;
  /** Description as source markup. */
  readonly html_description: string;
  /** Return types. Absent when the prose of the description resisted parsing. */
  readonly returns?: readonly string[];
  /** Parameters in documentation order. Absent for methods without a table. */
  readonly parameters?: readonly ApiField[];
  /** Prose attached to the method but outside its table. Absent when there is none. */
  readonly notes?: readonly ApiNote[];
}

/** A run of prose introduced by an `<h6>` inside an article. */
export interface DocsSubsection {
  /** Anchor of the heading. */
  readonly anchor: string;
  /** Text of the heading. */
  readonly title: string;
  /** Blocks between this heading and the next one. */
  readonly blocks: readonly DocsBlock[];
}

/**
 * A prose section of the documentation: everything that is not a type and not a
 * method.
 *
 * Existing specifications drop these entirely, which is how the escaping rules
 * of MarkdownV2 or the ports a webhook may listen on end up hand-written in
 * every library separately. They are kept here verbatim and structured, and the
 * build stage is what turns them into the sections of the specification.
 */
export interface DocsArticle {
  /** Anchor of the section on the documentation page. */
  readonly anchor: string;
  /** Anchor of the enclosing `<h3>` part. */
  readonly group: string;
  /** Heading of the section. */
  readonly title: string;
  /** Blocks above the first `<h6>`, or all of them when the section has none. */
  readonly blocks: readonly DocsBlock[];
  /** Runs of prose introduced by an `<h6>`. Absent when the section has none. */
  readonly subsections?: readonly DocsSubsection[];
}

/** The prose that opens an `<h3>` part, before its first `<h4>`. */
export interface DocsGroup {
  /** Anchor of the part. */
  readonly anchor: string;
  /** Heading of the part. */
  readonly title: string;
  /** Blocks between the heading and the first `<h4>`. */
  readonly blocks: readonly DocsBlock[];
}

/** One entry of Recent changes. */
export interface ChangelogEntry {
  /** Bot API version the entry announces, for example `10.3`. */
  readonly version: string;
  /** Date of the entry formatted `YYYY-MM-DD`. */
  readonly date: string;
  /** Anchor of the entry on the documentation page. */
  readonly anchor: string;
  /** Changes grouped as the documentation groups them. */
  readonly groups: readonly ChangelogGroup[];
}

/** One captioned list of changes inside a changelog entry. */
export interface ChangelogGroup {
  /** Caption above the list, for example `Rich Messages`. Empty when the list has none. */
  readonly title: string;
  /** The changes, one per list item. */
  readonly changes: readonly string[];
}

/** The whole scrape of the documentation page — the contents of `data/scrape.json`. */
export interface BotApiScrape {
  /** Bot API version, for example `10.3`. */
  readonly version: string;
  /** Release date of that version, formatted `YYYY-MM-DD`. */
  readonly release_date: string;
  /** Types keyed by name. */
  readonly types: Readonly<Record<string, ApiType>>;
  /** Methods keyed by name. */
  readonly methods: Readonly<Record<string, ApiMethod>>;
  /** Prose sections keyed by anchor. */
  readonly articles: Readonly<Record<string, DocsArticle>>;
  /** Prose opening each part, keyed by anchor. */
  readonly groups: Readonly<Record<string, DocsGroup>>;
  /** Recent changes, newest first. */
  readonly changelog: readonly ChangelogEntry[];
}
