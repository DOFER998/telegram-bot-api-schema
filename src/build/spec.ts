import type { Declarations } from '../declarations/load.ts';
import { type EnumApplications, resolveApplications } from '../enums/applications.ts';
import { findDiscriminators } from '../enums/discriminators.ts';
import type { ResolvedEnum } from '../enums/model.ts';
import { resolveEnums } from '../enums/resolve.ts';
import type { BotApiScrape, ChangelogEntry, DocsArticle, DocsGroup } from '../schema/model.ts';
import { type AccentColors, buildColors } from './articles/colors.ts';
import { buildCommandScopes, type CommandScopeChain } from './articles/commands.ts';
import { buildConventions, type Conventions } from './articles/conventions.ts';
import { buildEphemeral, type EphemeralMessages } from './articles/ephemeral.ts';
import { buildFormatting, type Formatting } from './articles/formatting.ts';
import { buildSendingFiles, type SendingFiles } from './articles/limits.ts';
import { buildRates, type Rates } from './articles/rates.ts';
import { buildTransport, type Transport } from './articles/transport.ts';
import { buildEntities, type SpecMethod, type SpecType } from './entities.ts';
import { collectFieldFacts } from './fields/collect.ts';
import type { FieldFacts } from './fields/model.ts';

/** Version of the specification format itself, apart from the Bot API version. */
export const SPEC_FORMAT_VERSION = 1;

/** An enum of the specification. */
export interface SpecEnum {
  /** Name of the enum. */
  readonly name: string;
  /** What the values are, in one line. */
  readonly description: string;
  /** Address of the section the values were read from. */
  readonly href?: string;
  /** The values on the wire, in documentation order. */
  readonly values: readonly string[];
  /**
   * An identifier-safe name for each value, aligned with `values`.
   *
   * Every consumer that generates code needs these, and for six of the values
   * no consumer can derive them: the dice emoji contain no characters an
   * identifier may hold, so the names come from the declaration that lists them.
   */
  readonly members: readonly string[];
  /** Members of the API typed by this enum, written `Entity.field`. */
  readonly applies_to?: readonly string[];
}

/** Everything the documentation says outside the tables of types and methods. */
export interface SpecDocument {
  /** Marking up a message: nesting, date-time formats and the parse modes. */
  readonly formatting: Formatting;
  /** The three ways of putting a file into a message, and their ceilings. */
  readonly sending_files: SendingFiles;
  /** Broadcast rates, the ephemeral reply window, update retention, local-server capabilities. */
  readonly rates: Rates;
  /** Accent colour palettes. */
  readonly colors: AccentColors;
  /** How a request is addressed and what comes back. */
  readonly transport: Transport;
  /** The order in which command scopes are searched. */
  readonly command_scopes: readonly CommandScopeChain[];
  /** How an ephemeral message is addressed and how long the window lasts. */
  readonly ephemeral_messages: EphemeralMessages;
  /** Rules the documentation states once, in passing, above a part of the page. */
  readonly conventions: Conventions;
  /** Every prose section of the page, verbatim and structured. */
  readonly articles: Readonly<Record<string, DocsArticle>>;
  /** The prose that opens each part of the page. */
  readonly parts: Readonly<Record<string, DocsGroup>>;
}

/** The whole specification — the contents of `spec.json`. */
export interface Spec {
  /** Version of this format. */
  readonly spec_format: number;
  /** Bot API version, for example `10.3`. */
  readonly version: string;
  /** Release date of that version, formatted `YYYY-MM-DD`. */
  readonly release_date: string;
  /** The page everything here was read from. */
  readonly source: string;
  /** Types keyed by name. */
  readonly types: Readonly<Record<string, SpecType>>;
  /** Methods keyed by name. */
  readonly methods: Readonly<Record<string, SpecMethod>>;
  /** Enums keyed by name. */
  readonly enums: Readonly<Record<string, SpecEnum>>;
  /** What the prose of each field states, keyed by `Entity.field`. */
  readonly fields: Readonly<Record<string, FieldFacts>>;
  /** Everything outside the tables. */
  readonly document: SpecDocument;
  /** Recent changes, newest first. */
  readonly changelog: readonly ChangelogEntry[];
}

/**
 * Assembles the specification.
 *
 * Types and methods keep the shape the ecosystem already uses; everything read
 * out of prose sits in its own section rather than being mixed into them.
 *
 * @param scrape the parsed scrape
 * @param declarations the loaded declarations
 * @param docsUrl address of the documentation page
 * @returns the specification
 */
export function buildSpec(scrape: BotApiScrape, declarations: Declarations, docsUrl: string): Spec {
  const { types, methods } = buildEntities(scrape, declarations, docsUrl);
  const enums = resolveEnums(scrape, declarations, findDiscriminators(scrape));
  const applications = resolveApplications(scrape, declarations);

  return {
    spec_format: SPEC_FORMAT_VERSION,
    version: scrape.version,
    release_date: scrape.release_date,
    source: docsUrl,
    types,
    methods,
    enums: toEnums(enums, applications, docsUrl),
    fields: collectFieldFacts(scrape, declarations),
    document: {
      formatting: buildFormatting(scrape),
      sending_files: buildSendingFiles(scrape),
      rates: buildRates(scrape),
      colors: buildColors(scrape),
      transport: buildTransport(scrape),
      command_scopes: buildCommandScopes(scrape),
      ephemeral_messages: buildEphemeral(scrape),
      conventions: buildConventions(scrape),
      articles: scrape.articles,
      parts: scrape.groups,
    },
    changelog: scrape.changelog,
  };
}

function toEnums(
  enums: readonly ResolvedEnum[],
  applications: EnumApplications,
  docsUrl: string,
): Readonly<Record<string, SpecEnum>> {
  const sites: Record<string, string[]> = {};
  for (const [site, name] of Object.entries(applications)) {
    const claimed = sites[name] ?? [];
    claimed.push(site);
    sites[name] = claimed;
  }

  return Object.fromEntries(
    enums.map((item): [string, SpecEnum] => {
      const appliesTo = sites[item.name];
      return [
        item.name,
        {
          name: item.name,
          description: item.description,
          ...(item.anchor === undefined ? {} : { href: `${docsUrl}#${item.anchor}` }),
          values: item.values.map((value) => value.value),
          members: item.values.map((value) => value.member),
          ...(appliesTo === undefined ? {} : { applies_to: appliesTo.toSorted() }),
        },
      ];
    }),
  );
}
