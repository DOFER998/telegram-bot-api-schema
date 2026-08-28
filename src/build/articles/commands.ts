import type { BotApiScrape } from '../../schema/model.ts';

/** One step of the search for the command list a user sees. */
export interface CommandScopeStep {
  /** The scope tried at this step. */
  readonly scope: string;
  /** Whether this step also requires a matching `language_code`. */
  readonly language_code: boolean;
  /** A qualifier the documentation attaches, such as `administrators only`. */
  readonly note?: string;
}

/** The ordered search for one kind of chat. */
export interface CommandScopeChain {
  /** The kind of chat, in the words of the documentation. */
  readonly chats: string;
  /** The scopes in the order they are tried; the first one that is set wins. */
  readonly steps: readonly CommandScopeStep[];
}

const DETERMINING = 'determining-list-of-commands';

const STEP = /^(botCommandScope[A-Za-z]+)( \+ language_code)?(?: \(([^)]+)\))?$/u;

/**
 * Reads the algorithm that decides which commands a user sees.
 *
 * The documentation states it as two ordered lists and nothing else does. A bot
 * that sets commands at several scopes cannot predict what a given user will be
 * shown without this order, so every library that offers a command menu carries
 * a copy of it in comments or in a developer's head.
 *
 * @param scrape the parsed scrape
 * @returns one chain per kind of chat
 * @throws when the article is missing or its lists no longer read as scopes
 */
export function buildCommandScopes(scrape: BotApiScrape): readonly CommandScopeChain[] {
  const article = scrape.articles[DETERMINING];
  if (article === undefined) {
    throw new Error(`The page has no #${DETERMINING} section — the documentation has changed`);
  }

  const chains: CommandScopeChain[] = [];
  let chats = '';

  for (const block of article.blocks) {
    if (block.items === undefined) {
      chats = block.text;
      continue;
    }
    const steps = block.items.map((item) => toStep(item, chats));
    chains.push({ chats, steps });
  }

  if (chains.length === 0) {
    throw new Error(`#${DETERMINING} no longer holds any ordered list of scopes`);
  }
  return chains;
}

function toStep(item: string, chats: string): CommandScopeStep {
  const match = STEP.exec(item);
  if (match === null) {
    throw new Error(`#${DETERMINING}: "${item}" under "${chats}" does not read as a command scope`);
  }
  return {
    scope: match[1] ?? '',
    language_code: match[2] !== undefined,
    ...(match[3] === undefined ? {} : { note: match[3] }),
  };
}
