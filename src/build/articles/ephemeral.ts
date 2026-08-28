import type { BotApiScrape, DocsArticle } from '../../schema/model.ts';

/** What lets a bot address an ephemeral message to a particular user. */
export interface EphemeralTarget {
  /** The parameter or field carrying the identifier, written as the documentation writes it. */
  readonly field: string;
  /** Where the identifier comes from. */
  readonly source: string;
}

/** How an ephemeral exchange is addressed and how long the window lasts. */
export interface EphemeralMessages {
  /** Anchor of the section. */
  readonly anchor: string;
  /** How long after an eligible action any bot may answer, in seconds. */
  readonly reply_window_seconds: number;
  /** The identifiers that open the window, either of which suffices. */
  readonly targets: readonly EphemeralTarget[];
  /** The parameter naming the recipient. */
  readonly receiver_field: string;
  /** The field that declares a command ephemeral. */
  readonly command_field: string;
  /** Whether a chat administrator may write at any time without an identifier. */
  readonly administrator_exemption: boolean;
  /** The sentence granting that exemption, kept because its caveats are prose. */
  readonly administrator_exemption_text?: string;
  /** Whether delivery is guaranteed. It is not, and a consumer should not assume it. */
  readonly delivery_guaranteed: false;
}

const ARTICLE = 'ephemeral-messages-and-commands';

/** `within 15 seconds of the incoming eligible action` */
const WINDOW = /within (\d+) seconds of the incoming eligible action/u;

/**
 * The two identifiers the documentation offers, each introduced by `The` and
 * followed by where it comes from.
 */
const TARGETS: readonly { readonly field: RegExp; readonly source: RegExp }[] = [
  {
    field: /The (callback_query_id) from/u,
    source: /The callback_query_id from (a received callback query)/u,
  },
  {
    field: /The (reply_parameters\.ephemeral_message_id) from/u,
    source: /The reply_parameters\.ephemeral_message_id from (an incoming ephemeral message)/u,
  },
];

/** `designated by the receiver_user_id parameter` */
const RECEIVER = /designated by the ([a-z_]+) parameter/u;

/** `setting the is_ephemeral field to True in the BotCommand class` */
const COMMAND_FIELD = /setting the ([a-z_]+) field to True in the BotCommand class/u;

/** `If the bot is a chat administrator, it can send an ephemeral message … at any time` */
const EXEMPTION = /^If the bot is a chat administrator.*at any time.*$/u;

/**
 * Reads how an ephemeral message is addressed.
 *
 * A bot answering an ephemeral command has fifteen seconds and must quote one
 * of two identifiers, unless it is an administrator. None of that is in any
 * table: `callback_query_id` and `reply_parameters.ephemeral_message_id` are
 * ordinary optional fields on the type, and only this paragraph says that
 * supplying neither is an error outside the exemption.
 *
 * @param scrape the parsed scrape
 * @returns the addressing rules
 * @throws when the section is missing or no longer states the window
 */
export function buildEphemeral(scrape: BotApiScrape): EphemeralMessages {
  const article = scrape.articles[ARTICLE];
  if (article === undefined) {
    throw new Error(`The page has no #${ARTICLE} section — the documentation has changed`);
  }

  const prose = text(article);

  const window = WINDOW.exec(prose);
  if (window === null) {
    throw new Error(`#${ARTICLE} no longer states the reply window`);
  }

  const targets = TARGETS.map(({ field, source }): EphemeralTarget => {
    const name = field.exec(prose)?.[1];
    const from = source.exec(prose)?.[1];
    if (name === undefined || from === undefined) {
      throw new Error(`#${ARTICLE} no longer names both identifiers that open the reply window`);
    }
    return { field: name, source: from };
  });

  const receiver = RECEIVER.exec(prose)?.[1];
  const command = COMMAND_FIELD.exec(prose)?.[1];
  if (receiver === undefined || command === undefined) {
    throw new Error(
      `#${ARTICLE} no longer names the receiver parameter or the ephemeral command field`,
    );
  }

  const exemption = items(article).find((item) => EXEMPTION.test(item));

  return {
    anchor: article.anchor,
    reply_window_seconds: Number(window[1]),
    targets,
    receiver_field: receiver,
    command_field: command,
    administrator_exemption: exemption !== undefined,
    ...(exemption === undefined ? {} : { administrator_exemption_text: exemption }),
    delivery_guaranteed: false,
  };
}

function text(article: DocsArticle): string {
  return article.blocks.map((block) => block.text).join('\n');
}

function items(article: DocsArticle): readonly string[] {
  return article.blocks.flatMap((block) => block.items ?? []);
}
