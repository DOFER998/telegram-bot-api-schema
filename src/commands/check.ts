import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { countLinks, findBrokenLinks } from '../build/links.ts';
import type { Spec } from '../build/spec.ts';
import { countUrls, FEWEST_ADDRESSES, findStrayUrls } from '../build/urls.ts';
import { loadConfig, type ResolvedConfig } from '../config.ts';
import { describeFaults, validateDocument } from '../openapi/validate.ts';

const LISTED = 20;

/**
 * The `check` stage: the published specification against its own schema, and
 * against itself.
 *
 * `schema.json` is a contract with consumers, and a contract nothing verifies is
 * a comment. The schema can only say that a type name is a string, though, and a
 * string naming nothing is still a string — so the references are followed
 * separately. Both run in CI, so neither can drift without somebody noticing.
 */
async function check(): Promise<void> {
  const config = loadConfig();
  const spec = JSON.parse(await readFile(config.published.spec, 'utf8')) as Spec;

  await checkSchema(config, spec);
  checkReferences(spec);
  await checkOpenApi(config);
  await checkAddresses(config);
}

/** The specification against the schema published beside it. */
async function checkSchema(config: ResolvedConfig, spec: Spec): Promise<void> {
  const schema = JSON.parse(await readFile(config.published.schema, 'utf8')) as object;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const validate = ajv.compile(schema);
  if (validate(spec)) {
    console.log(
      `${name(config, config.published.spec)} matches ${name(config, config.published.schema)}`,
    );
    return;
  }

  const errors = validate.errors ?? [];
  report(errors.map((error) => `${error.instancePath || '/'} ${error.message ?? ''}`));
  throw new Error(`The specification does not match its own schema: ${errors.length} problems`);
}

/**
 * Every name the specification uses against every name it defines.
 *
 * The schema can only say that a type name is a string, and a string naming
 * nothing is still a string.
 */
function checkReferences(spec: Spec): void {
  const broken = findBrokenLinks(spec);
  const followed = countLinks(spec);

  if (broken.length > 0) {
    report(
      broken.map(
        (link) => `${link.at} points at ${link.expected} ${link.target}, which is not defined`,
      ),
    );
    throw new Error(`${broken.length} of ${followed} internal references point at nothing`);
  }
  console.log(`${followed} internal references, all resolved`);
}

/** The OpenAPI document against the official meta-schema. */
async function checkOpenApi(config: ResolvedConfig): Promise<void> {
  const document = JSON.parse(await readFile(config.published.openapi, 'utf8')) as Record<
    string,
    unknown
  >;
  const result = await validateDocument(document);

  if (result.faults.length > 0) {
    for (const line of describeFaults(result)) {
      console.error(line);
    }
    throw new Error(`${name(config, config.published.openapi)} is not valid OpenAPI 3.1`);
  }
  console.log(
    `${name(config, config.published.openapi)} is valid OpenAPI 3.1 — ` +
      `${result.schemas} schemas, ${result.references} references, ${result.extensions} extensions`,
  );
}

/** Every published raw URL against the repository coordinates in the config. */
async function checkAddresses(config: ResolvedConfig): Promise<void> {
  const documents = [
    config.published.schema,
    config.published.openapi,
    resolve(config.root, 'README.md'),
  ];

  const stray = await findStrayUrls(config, documents);
  if (stray.length > 0) {
    report(stray.map(({ file, url }) => `${file} publishes ${url}, which is not this repository`));
    throw new Error(
      stray.length === 1
        ? '1 published address disagrees with schema.config.ts'
        : `${stray.length} published addresses disagree with schema.config.ts`,
    );
  }

  const addresses = await countUrls(documents);
  if (addresses < FEWEST_ADDRESSES) {
    throw new Error(
      `Only ${addresses} published addresses were found, fewer than the ${FEWEST_ADDRESSES} this repository must offer`,
    );
  }
  console.log(`${addresses} published addresses, all under ${config.rawBaseUrl}`);
}

function report(lines: readonly string[]): void {
  for (const line of lines.slice(0, LISTED)) {
    console.error(`  ! ${line}`);
  }
  if (lines.length > LISTED) {
    console.error(`  and ${lines.length - LISTED} more`);
  }
}

function name(config: ResolvedConfig, file: string): string {
  return relative(config.root, file);
}

try {
  await check();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
