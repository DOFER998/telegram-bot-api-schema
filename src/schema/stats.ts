import type { BotApiScrape } from './model.ts';

/** Summary of a scrape for the console. */
export interface ScrapeStats {
  /** Number of types. */
  readonly types: number;
  /** Number of methods. */
  readonly methods: number;
  /** Number of abstract types, that is, types with a list of subtypes. */
  readonly abstractTypes: number;
  /** Number of prose sections captured outside the entity tables. */
  readonly articles: number;
  /** Number of notes attached to entities but sitting outside their tables. */
  readonly notes: number;
  /** Number of changelog entries. */
  readonly changelog: number;
}

/** Counts up a scrape. */
export function collectStats(scrape: BotApiScrape): ScrapeStats {
  const types = Object.values(scrape.types);
  const methods = Object.values(scrape.methods);
  return {
    types: types.length,
    methods: methods.length,
    abstractTypes: types.filter((type) => type.subtypes !== undefined).length,
    articles: Object.keys(scrape.articles).length,
    notes: [...types, ...methods].reduce((total, entity) => total + (entity.notes?.length ?? 0), 0),
    changelog: scrape.changelog.length,
  };
}
