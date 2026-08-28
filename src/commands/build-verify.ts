import { buildSpec } from '../build/spec.ts';
import { loadConfig } from '../config.ts';
import { loadDeclarations } from '../declarations/load.ts';
import { describeDifference } from '../diff/text.ts';
import { serializeJson } from '../schema/json.ts';
import { readScrape } from '../schema/read.ts';

/**
 * Self-check of the `build` stage: one scrape, two builds, compared.
 *
 * The nightly job decides whether to open a pull request by comparing the built
 * specification with the committed one. A build that is not a pure function of
 * its inputs would differ from itself, the job would open a pull request every
 * night, and within a fortnight nobody would read them.
 */
async function verify(): Promise<void> {
  const config = loadConfig();
  const scrape = await readScrape(config.scrapeFile);
  const declarations = await loadDeclarations(config);

  const first = serializeJson(buildSpec(scrape, declarations, config.docsUrl));
  const second = serializeJson(buildSpec(scrape, declarations, config.docsUrl));

  console.log(`  build 1  ${Buffer.byteLength(first, 'utf8')} bytes`);
  console.log(`  build 2  ${Buffer.byteLength(second, 'utf8')} bytes`);

  if (first !== second) {
    throw new Error(describeDifference('build 1', first, 'build 2', second));
  }
  console.log('two builds of one scrape produced byte-identical JSON');
}

try {
  await verify();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
