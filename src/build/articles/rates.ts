import type { BotApiScrape } from '../../schema/model.ts';

/** A number the documentation states once, in prose, and every consumer then hard-codes. */
export interface StatedNumber {
  /** The number. */
  readonly value: number;
  /** What it measures. */
  readonly unit: string;
  /** Anchor of the section it was read from. */
  readonly source: string;
}

/** Ceilings that govern how fast and how privately a bot may send. */
export interface Rates {
  /** Broadcast ceilings and what exceeding the free one costs. */
  readonly paid_broadcasts: Readonly<Record<string, StatedNumber>>;
  /** Ceilings on an ephemeral exchange. */
  readonly ephemeral_messages: Readonly<Record<string, StatedNumber>>;
  /** How long an undelivered update is kept. */
  readonly updates: Readonly<Record<string, StatedNumber>>;
  /** What a self-hosted Bot API server changes. */
  readonly local_bot_api_server: readonly LocalServerCapability[];
  /** When a paid broadcast is actually billed. */
  readonly paid_broadcast_charging: PaidBroadcastCharging;
}

/** When a message broadcast over the free rate costs anything. */
export interface PaidBroadcastCharging {
  /** Whether only messages that went out are charged for. Only those are. */
  readonly successful_only: boolean;
  /** The sentence it was read from. */
  readonly text: string;
}

/** One thing a self-hosted Bot API server allows that the shared one does not. */
export interface LocalServerCapability {
  /** The capability in the words of the documentation. */
  readonly text: string;
  /** The ceiling it raises, where the sentence names one. */
  readonly limit?: { readonly value: number; readonly unit: string };
}

interface Probe {
  /** Key the number takes in the specification. */
  readonly key: string;
  /** What the number measures. */
  readonly unit: string;
  /** The one phrasing the documentation uses. */
  readonly pattern: RegExp;
}

const PAID_BROADCASTS = 'paid-broadcasts';
const EPHEMERAL = 'ephemeral-messages-and-commands';
const GETTING_UPDATES = 'getting-updates';
const LOCAL_SERVER = 'using-a-local-bot-api-server';

const PAID_BROADCAST_PROBES: readonly Probe[] = [
  {
    key: 'free_rate',
    unit: 'messages per second',
    pattern: /all bots are able to broadcast up to ([\d,]+) messages per second/u,
  },
  {
    key: 'paid_rate',
    unit: 'messages per second',
    pattern: /allowing their bot to broadcast up to ([\d,]+) messages per second/u,
  },
  {
    key: 'cost_per_message',
    unit: 'Telegram Stars',
    pattern: /cost of ([\d.]+) Stars per message/u,
  },
  {
    key: 'minimum_balance',
    unit: 'Telegram Stars',
    pattern: /at least ([\d,]+) Stars on its balance/u,
  },
];

const EPHEMERAL_PROBES: readonly Probe[] = [
  {
    key: 'reply_window',
    unit: 'seconds',
    pattern: /within (\d+) seconds of the incoming eligible action/u,
  },
];

/** `Bots with increased limits are only charged for messages that are broadcasted successfully.` */
const CHARGED_ON_SUCCESS = /only charged for messages that are broadcasted successfully/u;

const UPDATE_PROBES: readonly Probe[] = [
  { key: 'retention', unit: 'hours', pattern: /will not be kept longer than (\d+) hours/u },
];

/**
 * Reads the numbers the documentation states in running prose.
 *
 * Every probe must match. There is no count that could fall here — the number
 * is either read or it is not — so a changed phrasing stops the build rather
 * than leaving the section quietly emptier.
 *
 * @param scrape the parsed scrape
 * @returns the numbers, keyed by what they govern
 * @throws when a section is missing or a probe no longer matches
 */
export function buildRates(scrape: BotApiScrape): Rates {
  return {
    paid_broadcasts: probe(scrape, PAID_BROADCASTS, PAID_BROADCAST_PROBES),
    ephemeral_messages: probe(scrape, EPHEMERAL, EPHEMERAL_PROBES),
    updates: probe(scrape, GETTING_UPDATES, UPDATE_PROBES),
    local_bot_api_server: capabilities(scrape),
    paid_broadcast_charging: charging(scrape),
  };
}

function probe(
  scrape: BotApiScrape,
  anchor: string,
  probes: readonly Probe[],
): Readonly<Record<string, StatedNumber>> {
  const text = proseOf(scrape, anchor);
  const found: Record<string, StatedNumber> = {};
  const claimed = new Map<number, string>();

  for (const { key, unit, pattern } of probes) {
    // `d` records where each group matched. The whole match is the wrong thing
    // to compare: two probes reading one number through differently worded
    // lead-ins start at different offsets and end on the same digits.
    const match = new RegExp(pattern.source, `${pattern.flags}d`).exec(text);
    if (match === null) {
      throw new Error(
        `#${anchor} no longer states the ${key.replace(/_/gu, ' ')} — the phrasing ${pattern} matches nothing`,
      );
    }

    // Two probes reading the same digits means one of them lost its anchor and
    // is now reporting the other's number. Nothing about the shape of the output
    // would show it: both keys are present and both hold a plausible value.
    const at = match.indices?.[1]?.[0] ?? match.index;
    const owner = claimed.get(at);
    if (owner !== undefined) {
      throw new Error(
        `#${anchor}: ${key} and ${owner} both read the number at offset ${at} — one of the two phrasings has stopped being specific`,
      );
    }
    claimed.set(at, key);

    found[key] = { value: Number((match[1] ?? '').replace(/[\s,]/gu, '')), unit, source: anchor };
  }
  return found;
}

/**
 * Numbers a local-server capability may carry, each with the unit it is in.
 *
 * Two of the eight sentences name a ceiling; the rest lift a restriction that
 * has no number. A consumer choosing between the shared server and its own is
 * choosing on those two numbers, and today it reads them out of a sentence.
 */
const CAPABILITY_LIMITS: readonly { readonly pattern: RegExp; readonly unit: string }[] = [
  { pattern: /[Uu]pload files up to ([\d,]+) MB/u, unit: 'megabytes' },
  { pattern: /max_webhook_connections up to ([\d,]+)/u, unit: 'connections' },
];

function charging(scrape: BotApiScrape): PaidBroadcastCharging {
  const text = (scrape.articles[PAID_BROADCASTS]?.blocks ?? [])
    .map((block) => block.text)
    .find((candidate) => CHARGED_ON_SUCCESS.test(candidate));
  if (text === undefined) {
    throw new Error(`#${PAID_BROADCASTS} no longer states when a paid broadcast is charged`);
  }
  return { successful_only: true, text };
}

function capabilities(scrape: BotApiScrape): readonly LocalServerCapability[] {
  const group = scrape.groups[LOCAL_SERVER];
  const items = group?.blocks.find((block) => block.items !== undefined)?.items;
  if (items === undefined || items.length === 0) {
    throw new Error(`#${LOCAL_SERVER} no longer lists what a local server changes`);
  }

  const capabilities = items.map((text): LocalServerCapability => {
    const found = CAPABILITY_LIMITS.map(({ pattern, unit }) => {
      const match = pattern.exec(text);
      return match === null
        ? undefined
        : { value: Number((match[1] ?? '').replace(/,/gu, '')), unit };
    }).find((limit) => limit !== undefined);
    return { text, ...(found === undefined ? {} : { limit: found }) };
  });

  const withLimits = capabilities.filter((capability) => capability.limit !== undefined).length;
  if (withLimits !== CAPABILITY_LIMITS.length) {
    throw new Error(
      `#${LOCAL_SERVER}: ${withLimits} of ${CAPABILITY_LIMITS.length} ceilings were found — a phrasing has changed`,
    );
  }
  return capabilities;
}

/** A section may be a part with introductory prose or an article; both carry blocks. */
function proseOf(scrape: BotApiScrape, anchor: string): string {
  const blocks = scrape.articles[anchor]?.blocks ?? scrape.groups[anchor]?.blocks;
  if (blocks === undefined) {
    throw new Error(`The page has no #${anchor} section — the documentation has changed`);
  }
  return blocks.map((block) => block.text).join('\n');
}
