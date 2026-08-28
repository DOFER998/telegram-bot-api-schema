import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative } from 'node:path';
import { loadConfig } from '../config.ts';
import { serializeJson } from '../schema/json.ts';
import { collectStats } from '../schema/stats.ts';
import { fetchDocsPage } from '../scrape/docs-page.ts';
import { parseDocsPage } from '../scrape/parse.ts';

/** The `scrape` stage: the Bot API documentation page into `data/scrape.json`. */
async function scrape(): Promise<void> {
  const config = loadConfig();
  const parsed = parseDocsPage(await fetchDocsPage(config.docsUrl));
  const stats = collectStats(parsed);

  await mkdir(dirname(config.scrapeFile), { recursive: true });
  await writeFile(config.scrapeFile, serializeJson(parsed), 'utf8');

  console.log(`Bot API ${parsed.version} (${parsed.release_date})`);
  console.log(`  types             ${stats.types}`);
  console.log(`  methods           ${stats.methods}`);
  console.log(`  abstract types    ${stats.abstractTypes}`);
  console.log(`  prose sections    ${stats.articles}`);
  console.log(`  entity notes      ${stats.notes}`);
  console.log(`  changelog entries ${stats.changelog}`);
  console.log(`-> ${relative(config.root, config.scrapeFile)}`);
}

try {
  await scrape();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
