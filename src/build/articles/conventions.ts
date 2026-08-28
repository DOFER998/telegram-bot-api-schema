import type { DocsBlock } from '../../html/blocks.ts';
import { compareStrings } from '../../ordering.ts';
import type { BotApiScrape } from '../../schema/model.ts';

/** How wide an `Integer` is unless a field says otherwise. */
export interface IntegerConvention {
  /** Bits a plain `Integer` fits in. */
  readonly bits: number;
  /** Whether that width is signed. */
  readonly signed: boolean;
  /** Whether individual fields may override it. They may, and 21 of them do. */
  readonly unless_noted: boolean;
  /** The sentence it was read from. */
  readonly text: string;
}

/** What the absence of an optional field means. */
export interface OptionalFieldConvention {
  /** Whether an omitted optional field is normal rather than an error. */
  readonly may_be_absent: boolean;
  /** The sentence it was read from. */
  readonly text: string;
}

/** One part of an authentication token. */
export interface TokenPart {
  /** The part as the documentation's example writes it. */
  readonly example: string;
  /** Character classes that part is built from, as observed in the example. */
  readonly characters: readonly string[];
  /** Length of that part in the example. */
  readonly length: number;
}

/** The shape of an authentication token. */
export interface TokenConvention {
  /** The example the documentation gives. */
  readonly example: string;
  /** The character that divides the parts. */
  readonly separator: string;
  /**
   * The parts, described by what the example is made of.
   *
   * The documentation gives one example and no grammar, so this is what that
   * example contains and nothing more. A bot that rejects a token because a
   * character class absent from one example is absent from the rules would be
   * a library inventing a constraint Telegram never stated.
   */
  readonly parts: readonly TokenPart[];
  /** Says plainly that the shape was read off an example rather than declared. */
  readonly derived_from_example: true;
}

/** How updates reach a bot. */
export interface UpdateDelivery {
  /** The two ways, in the words of the documentation. */
  readonly methods: readonly string[];
  /** Whether choosing one rules out the other. It does. */
  readonly mutually_exclusive: boolean;
  /** How long an undelivered update is kept, in hours. */
  readonly retention_hours: number;
  /** The sentence it was read from. */
  readonly text: string;
}

/** Which messages can be edited at all. */
export interface MessageEditing {
  /**
   * States of `reply_markup` that permit editing.
   *
   * `absent` or an inline keyboard. A message carrying a reply keyboard cannot
   * be edited, and a library that discovers this from a rejected call has spent
   * a debugging session on a sentence in an introduction.
   */
  readonly editable_reply_markup: readonly string[];
  /** The sentence it was read from. */
  readonly text: string;
}

/** How games are created and the one hard rule on their keyboard. */
export interface GamesConvention {
  /** The command that creates a game. */
  readonly enabled_by: string;
  /** Who the command is sent to. */
  readonly via: string;
  /**
   * Whether the first button of the first row must be the one that launches the
   * game.
   *
   * It must. A game message whose keyboard puts anything else first is rejected,
   * and nothing in `sendGame` or `InlineKeyboardMarkup` says so.
   */
  readonly first_button_launches_game: boolean;
  /** The sentence it was read from. */
  readonly text: string;
}

/** How inline mode is switched on. */
export interface InlineModeConvention {
  /** The command that enables it. */
  readonly enabled_by: string;
  /** Who the command is sent to. */
  readonly via: string;
  /** The sentence it was read from. */
  readonly text: string;
}

/** A sentence the page states in more than one section. */
export interface RepeatedStatement {
  /** The sentence, printed once here. */
  readonly text: string;
  /** Anchors of every section that states it, in alphabetical order. */
  readonly sections: readonly string[];
}

/** Rules the documentation states once, in passing, and no specification carries. */
export interface Conventions {
  /** How wide an `Integer` is unless a field says otherwise. */
  readonly integers: IntegerConvention;
  /** What the absence of an optional field means. */
  readonly optional_fields: OptionalFieldConvention;
  /** The shape of an authentication token. */
  readonly token: TokenConvention;
  /** How updates reach a bot. */
  readonly update_delivery: UpdateDelivery;
  /** Which messages can be edited at all. */
  readonly message_editing: MessageEditing;
  /** How inline mode is switched on. */
  readonly inline_mode: InlineModeConvention;
  /** How games are created and the one hard rule on their keyboard. */
  readonly games: GamesConvention;
  /**
   * Sentences the page states more than once, recorded with every place they
   * appear.
   *
   * The introduction to Available methods restates what Making requests already
   * said. Carrying both copies would leave a consumer wondering which is
   * authoritative; carrying the sentence once, with its addresses, answers that
   * and costs nothing.
   */
  readonly repeated_statements: readonly RepeatedStatement[];
}

/** `It is safe to use 32-bit signed integers for storing all Integer fields unless otherwise noted.` */
const INTEGERS =
  /It is safe to use (\d+)-bit (signed|unsigned) integers for storing all Integer fields( unless otherwise noted)?/u;

/** `Optional fields may be not returned when irrelevant.` */
const OPTIONAL_FIELDS = /Optional fields may be not returned when irrelevant/u;

/** `The token looks something like 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11` */
const TOKEN = /The token looks something like (\S+?),/u;

/** `two mutually exclusive ways … the getUpdates method on one hand and webhooks on the other` */
const DELIVERY =
  /two mutually exclusive ways of receiving updates[^.]*?the (\w+) method on one hand and (\w+) on the other/u;

/** `they will not be kept longer than 24 hours` */
const RETENTION = /will not be kept longer than (\d+) hours/u;

/** `only possible to edit messages without reply_markup or with inline keyboards` */
const EDITING = /only possible to edit messages without ([a-z_]+) or with inline keyboards/u;

/** `send the /setinline command to @BotFather` */
const INLINE_MODE = /send the (\/\w+) command to (@\w+)/u;

/** `Create games via @BotFather using the /newgame command.` */
const GAMES = /Create games via (@\w+) using the (\/\w+) command/u;

/** `the first button in the first row must always launch the game` */
const FIRST_BUTTON = /^.*first button in the first row must always launch the game.*$/u;

const CHARACTER_CLASSES: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  { name: 'digits', pattern: /\d/u },
  { name: 'uppercase letters', pattern: /[A-Z]/u },
  { name: 'lowercase letters', pattern: /[a-z]/u },
  { name: 'hyphen', pattern: /-/u },
  { name: 'underscore', pattern: /_/u },
];

const TOKEN_SEPARATOR = ':';

/**
 * Reads the rules the documentation drops into its introductions.
 *
 * Each is a single sentence sitting above a part of the page, and each governs
 * every call in that part. A bot that stores an `Integer` in 32 bits because a
 * sentence said so, and then meets a chat identifier that needs 52, has met the
 * cost of these sentences not being data.
 *
 * @param scrape the parsed scrape
 * @returns the conventions
 * @throws when a sentence that used to be there no longer is
 */
export function buildConventions(scrape: BotApiScrape): Conventions {
  return {
    integers: parseIntegers(scrape),
    optional_fields: parseOptionalFields(scrape),
    token: parseToken(scrape),
    update_delivery: parseDelivery(scrape),
    message_editing: parseEditing(scrape),
    inline_mode: parseInlineMode(scrape),
    games: parseGames(scrape),
    repeated_statements: findRepeats(scrape),
  };
}

function parseIntegers(scrape: BotApiScrape): IntegerConvention {
  const { match, text } = require(scrape, 'available-types', INTEGERS, 'the width of an Integer');
  return {
    bits: Number(match[1]),
    signed: match[2] === 'signed',
    unless_noted: match[3] !== undefined,
    text,
  };
}

function parseOptionalFields(scrape: BotApiScrape): OptionalFieldConvention {
  const {
    text,
  } = require(scrape, 'available-types', OPTIONAL_FIELDS, 'what an absent optional field means');
  return { may_be_absent: true, text };
}

function parseToken(scrape: BotApiScrape): TokenConvention {
  const { match } = require(scrape, 'authorizing-your-bot', TOKEN, 'the shape of a token');
  const example = match[1] ?? '';
  const parts = example.split(TOKEN_SEPARATOR);
  if (parts.length < 2) {
    throw new Error(
      `#authorizing-your-bot: the token example "${example}" holds no "${TOKEN_SEPARATOR}" — the shape has changed`,
    );
  }

  return {
    example,
    separator: TOKEN_SEPARATOR,
    parts: parts.map((part) => ({
      example: part,
      characters: CHARACTER_CLASSES.filter(({ pattern }) => pattern.test(part)).map(
        ({ name }) => name,
      ),
      length: part.length,
    })),
    derived_from_example: true,
  };
}

function parseDelivery(scrape: BotApiScrape): UpdateDelivery {
  const {
    match,
    text,
  } = require(scrape, 'getting-updates', DELIVERY, 'the two ways of receiving updates');
  const retention = RETENTION.exec(prose(scrape, 'getting-updates'));
  if (retention === null) {
    throw new Error('#getting-updates no longer states how long an undelivered update is kept');
  }
  return {
    methods: [match[1] ?? '', match[2] ?? ''],
    mutually_exclusive: true,
    retention_hours: Number(retention[1]),
    text,
  };
}

function parseEditing(scrape: BotApiScrape): MessageEditing {
  const {
    match,
    text,
  } = require(scrape, 'updating-messages', EDITING, 'which messages can be edited');
  return {
    editable_reply_markup: [`${match[1]} absent`, 'InlineKeyboardMarkup'],
    text,
  };
}

function parseInlineMode(scrape: BotApiScrape): InlineModeConvention {
  const { match, text } = require(scrape, 'inline-mode', INLINE_MODE, 'how inline mode is enabled');
  return { enabled_by: match[1] ?? '', via: match[2] ?? '', text };
}

function parseGames(scrape: BotApiScrape): GamesConvention {
  const { match, text } = require(scrape, 'games', GAMES, 'how a game is created');
  const rule = (scrape.groups.games?.blocks ?? [])
    .flatMap((block) => block.items ?? [])
    .find((item) => FIRST_BUTTON.test(item));
  if (rule === undefined) {
    throw new Error('#games no longer states that the first button must launch the game');
  }
  return {
    enabled_by: match[2] ?? '',
    via: match[1] ?? '',
    first_button_launches_game: true,
    text: `${text}\n${rule}`,
  };
}

/**
 * A sentence ends at a full stop followed by a space and a capital, or at the
 * end of a block. Splitting on the full stop alone would cut `e.g.` and every
 * version number in half.
 */
const SENTENCE = /(?<=\.)\s+(?=[A-Z])/u;

/**
 * Short enough to be a caption rather than a statement.
 *
 * `Please note:` opens four sections and says nothing; a threshold keeps the
 * list to sentences that actually carry a rule.
 */
const SHORTEST_STATEMENT = 40;

/** Blocks that hold a demonstration rather than prose. */
const SAMPLE_TAGS: ReadonlySet<string> = new Set(['pre']);

/**
 * Finds sentences the page states in more than one section.
 *
 * The introduction to Available methods says again, in its own words, what
 * Making requests already said — so a whole-block comparison finds nothing
 * while two of its sentences are verbatim repeats. Comparing sentences is what
 * makes the repetition visible without anybody asserting it.
 */
function findRepeats(scrape: BotApiScrape): readonly RepeatedStatement[] {
  const places = new Map<string, Set<string>>();

  const visit = (anchor: string, blocks: readonly DocsBlock[]): void => {
    for (const block of blocks) {
      // A syntax sample is not a statement. The two formatting sections
      // demonstrate `tg-emoji` with the same identifier, and counting that as
      // the page saying one thing twice would bury the sentences that are.
      if (SAMPLE_TAGS.has(block.tag)) {
        continue;
      }
      const sentences = block.text
        .split('\n')
        .flatMap((line) => line.split(SENTENCE))
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length >= SHORTEST_STATEMENT);
      for (const sentence of sentences) {
        const seen = places.get(sentence) ?? new Set<string>();
        places.set(sentence, seen);
        seen.add(anchor);
      }
    }
  };

  for (const part of Object.values(scrape.groups)) {
    visit(part.anchor, part.blocks);
  }
  for (const article of Object.values(scrape.articles)) {
    visit(article.anchor, article.blocks);
    for (const section of article.subsections ?? []) {
      visit(article.anchor, section.blocks);
    }
  }

  return [...places]
    .filter(([, sections]) => sections.size > 1)
    .map(([text, sections]) => ({ text, sections: [...sections].toSorted(compareStrings) }))
    .toSorted((left, right) => compareStrings(left.text, right.text));
}

interface Found {
  readonly match: RegExpExecArray;
  readonly text: string;
}

/**
 * Runs a pattern over one part and fails when it no longer matches.
 *
 * Every convention here is a single sentence. There is no count that could fall
 * to signal its loss — the sentence is either read or it is not — so each is
 * required outright.
 */
function require(scrape: BotApiScrape, anchor: string, pattern: RegExp, what: string): Found {
  const blocks = scrape.groups[anchor]?.blocks;
  if (blocks === undefined) {
    throw new Error(`The page has no #${anchor} part — the documentation has changed`);
  }
  for (const block of blocks) {
    const match = pattern.exec(block.text);
    if (match !== null) {
      return { match, text: block.text };
    }
  }
  throw new Error(`#${anchor} no longer states ${what} — the phrasing ${pattern} matches nothing`);
}

function prose(scrape: BotApiScrape, anchor: string): string {
  return (scrape.groups[anchor]?.blocks ?? []).map((block) => block.text).join('\n');
}
