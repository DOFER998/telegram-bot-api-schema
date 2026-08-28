import { readFile, writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { census } from '../build/census.ts';
import { findShortfalls, readExpectations } from '../build/expectations.ts';
import { buildSpec, type Spec } from '../build/spec.ts';
import { loadConfig } from '../config.ts';
import { loadDeclarations } from '../declarations/load.ts';
import { validateDeclarations } from '../declarations/validate.ts';
import { buildOpenApi } from '../openapi/document.ts';
import { serializeJson } from '../schema/json.ts';
import { fetchDocsPage } from '../scrape/docs-page.ts';
import { parseDocsPage } from '../scrape/parse.ts';
import { compareSpecVersions, formatReport, isUnchanged } from '../update/report.ts';

const REPORT_FLAG = '--report';

/**
 * The `update` stage: scrape, build, compare with what is committed.
 *
 * The whole of the nightly job in one command. It exits 0 and writes nothing
 * when the documentation has not moved, and exits 0 having written the new
 * specification and a report when it has. Only a genuine fault — a page that no
 * longer parses, a declaration gone stale, an extractor that stopped extracting
 * — exits non-zero, so a red run always means something needs a person.
 */
async function update(): Promise<void> {
  const config = loadConfig();
  const reportAt = reportPath();

  const scrape = parseDocsPage(await fetchDocsPage(config.docsUrl));
  const declarations = await loadDeclarations(config);

  const complaints = validateDeclarations(scrape, declarations);
  if (complaints.length > 0) {
    for (const complaint of complaints) {
      console.error(`  ! ${complaint}`);
    }
    throw new Error('Declarations no longer match the documentation — nothing written');
  }

  const next = buildSpec(scrape, declarations, config.docsUrl);
  const counts = census(next);
  const shortfalls = findShortfalls(await readExpectations(config.expectationsFile), counts);
  if (shortfalls.length > 0) {
    for (const { category, expected, actual } of shortfalls) {
      console.error(`  ! ${category} — extracted ${actual}, expected about ${expected}`);
    }
    throw new Error('Extraction fell sharply — a pattern has most likely stopped matching');
  }

  // The OpenAPI document is published beside the specification, so the nightly
  // job has to rebuild it too. Leaving it behind would publish a document that
  // silently describes an older Bot API than the file next to it.
  const openapi = buildOpenApi(next);
  const losses = openapi.ledger.losses();
  if (losses.length > 0) {
    for (const { category, lost } of losses) {
      console.error(
        `  ! ${category} — ${lost} facts reached neither an OpenAPI field nor an extension`,
      );
    }
    throw new Error(
      'The OpenAPI document would lose facts the specification holds — nothing written',
    );
  }

  const previous = await readCommitted(config.published.spec);
  const change = compareSpecVersions(previous, next);

  console.log(`Bot API ${next.version} (${next.release_date})`);

  if (previous !== undefined && isUnchanged(change)) {
    console.log('no change against the committed specification');
    return;
  }

  await writeFile(config.published.spec, serializeJson(next), 'utf8');
  await writeFile(config.published.openapi, serializeJson(openapi.document), 'utf8');
  await writeFile(
    config.published.version,
    `BOT_API_VERSION=${next.version}\nBOT_API_RELEASE_DATE=${next.release_date}\n`,
    'utf8',
  );
  await writeFile(config.scrapeFile, serializeJson(scrape), 'utf8');

  const report = formatReport(change, next);

  if (reportAt !== undefined) {
    await writeFile(reportAt, report, 'utf8');
    console.log(`-> ${relative(config.root, reportAt)}`);
  } else {
    console.log(`\n${report}`);
  }

  console.log(`-> ${relative(config.root, config.published.spec)} and the files beside it`);
}

/** `--report <path>` sends the pull-request body to a file the workflow can read. */
function reportPath(): string | undefined {
  const at = process.argv.indexOf(REPORT_FLAG);
  return at < 0 ? undefined : process.argv[at + 1];
}

async function readCommitted(file: string): Promise<Spec | undefined> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as Spec;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

try {
  await update();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
