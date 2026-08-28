import { readFile } from 'node:fs/promises';
import type { BotApiScrape } from './model.ts';

/**
 * Reads the scrape left behind by the `scrape` stage.
 *
 * @param scrapeFile path to `data/scrape.json`
 * @returns the parsed scrape
 * @throws when the file is absent, which means `scrape` has never run
 */
export async function readScrape(scrapeFile: string): Promise<BotApiScrape> {
  try {
    return JSON.parse(await readFile(scrapeFile, 'utf8')) as BotApiScrape;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`No scrape at ${scrapeFile} — run bun run scrape first`, { cause: error });
    }
    throw error;
  }
}
