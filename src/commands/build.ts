import { writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { census } from '../build/census.ts';
import {
  findShortfalls,
  findUnrecorded,
  readExpectations,
  writeExpectations,
} from '../build/expectations.ts';
import { buildSpec } from '../build/spec.ts';
import { loadConfig } from '../config.ts';
import { loadDeclarations } from '../declarations/load.ts';
import { validateDeclarations } from '../declarations/validate.ts';
import { buildOpenApi } from '../openapi/document.ts';
import { serializeJson } from '../schema/json.ts';
import { readScrape } from '../schema/read.ts';

const ACCEPT_FLAG = '--accept';

/**
 * The `build` stage: the scrape and the declarations into the published files.
 *
 * Passing `--accept` records the counts this build produced as the new floor.
 * That is a deliberate act with a diff attached, which is the only thing that
 * keeps the floor from being whatever the last run happened to manage.
 */
async function build(): Promise<void> {
  const config = loadConfig();
  const accept = process.argv.includes(ACCEPT_FLAG);

  const scrape = await readScrape(config.scrapeFile);
  const declarations = await loadDeclarations(config);

  const complaints = validateDeclarations(scrape, declarations);
  if (complaints.length > 0) {
    for (const complaint of complaints) {
      console.error(`  ! ${complaint}`);
    }
    throw new Error('Declarations no longer match the documentation — nothing written');
  }

  const spec = buildSpec(scrape, declarations, config.docsUrl);
  const counts = census(spec);

  const expectations = await readExpectations(config.expectationsFile);
  const shortfalls = findShortfalls(expectations, counts);
  const unrecorded = findUnrecorded(expectations, counts);

  console.log(`Bot API ${spec.version} (${spec.release_date})`);
  console.log(`  types   ${counts.types}   methods ${counts.methods}   enums ${counts.enums}`);
  console.log(`  fields with extracted facts  ${counts['fields.total']}`);
  console.log(`  entity notes                 ${counts['notes.entities']}`);
  console.log(`  prose sections               ${counts['document.articles']}`);

  for (const category of unrecorded) {
    console.log(`  + ${category} — new category, ${counts[category]} found, not yet guarded`);
  }

  if (shortfalls.length > 0) {
    for (const { category, expected, actual } of shortfalls) {
      console.error(`  ! ${category} — extracted ${actual}, expected about ${expected}`);
    }
    throw new Error(
      'Extraction fell sharply in the categories above. A pattern has most likely stopped matching. ' +
        `Check them, then run with ${ACCEPT_FLAG} if the drop is genuine.`,
    );
  }

  const openapi = buildOpenApi(spec);
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

  await writeFile(config.published.spec, serializeJson(spec), 'utf8');
  await writeFile(config.published.openapi, serializeJson(openapi.document), 'utf8');
  await writeFile(
    config.published.version,
    `BOT_API_VERSION=${spec.version}\nBOT_API_RELEASE_DATE=${spec.release_date}\n`,
    'utf8',
  );

  if (accept) {
    await writeExpectations(config.expectationsFile, counts);
    console.log(`-> ${relative(config.root, config.expectationsFile)} (floor accepted)`);
  }

  for (const file of [config.published.spec, config.published.openapi, config.published.version]) {
    console.log(`-> ${relative(config.root, file)}`);
  }
}

try {
  await build();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
