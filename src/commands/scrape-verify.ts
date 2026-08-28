import { loadConfig } from '../config.ts';
import { describeDifference } from '../diff/text.ts';
import { serializeJson } from '../schema/json.ts';
import { fetchDocsPage } from '../scrape/docs-page.ts';
import { parseDocsPage } from '../scrape/parse.ts';

/**
 * Self-check of the `scrape` stage: one download, two parses, compared.
 *
 * A nightly job watches the specification for changes to the Bot API. A noisy
 * parse would produce a false diff on every run, the diffs would start being
 * ignored, and the mechanism would die quietly. The check writes nothing to
 * disk: the page is downloaded once, so a mismatch can only come from parsing.
 */
async function verify(): Promise<void> {
  const config = loadConfig();
  const html = await fetchDocsPage(config.docsUrl);

  const parsed = parseDocsPage(html);
  const first = serializeJson(parsed);
  const second = serializeJson(parseDocsPage(html));

  console.log(`Bot API ${parsed.version} (${parsed.release_date})`);
  console.log(`  page     ${Buffer.byteLength(html, 'utf8')} bytes`);
  console.log(`  parse 1  ${Buffer.byteLength(first, 'utf8')} bytes`);
  console.log(`  parse 2  ${Buffer.byteLength(second, 'utf8')} bytes`);

  if (first !== second) {
    throw new Error(describeDifference('parse 1', first, 'parse 2', second));
  }
  console.log('two parses of one page produced byte-identical JSON');
}

try {
  await verify();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
