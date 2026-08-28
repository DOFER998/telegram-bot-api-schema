import { readFile } from 'node:fs/promises';
import type { Spec } from '../build/spec.ts';
import { loadConfig } from '../config.ts';

const TAG_FLAG = '--tag';

/**
 * Prints the body of a GitHub release for the committed specification.
 *
 * Written here rather than in the workflow because it reads `spec.json`, and a
 * shell script that reaches into a two-megabyte JSON file with `sed` is a thing
 * that breaks quietly the first time a key moves.
 */
async function releaseNotes(): Promise<void> {
  const config = loadConfig();
  const spec = JSON.parse(await readFile(config.published.spec, 'utf8')) as Spec;
  const tag = taggedAs() ?? `v${spec.version}.0`;

  const lines: string[] = [
    `Bot API **${spec.version}**, released by Telegram on ${spec.release_date}.`,
    '',
    '## Fetch it',
    '',
    '```',
    `${config.rawBaseUrl.replace(/\/[^/]+$/u, `/${tag}`)}/spec.json`,
    `${config.rawBaseUrl.replace(/\/[^/]+$/u, `/${tag}`)}/openapi.json`,
    '```',
    '',
    '## What it holds',
    '',
    '| | |',
    '| --- | --- |',
    `| Types | ${Object.keys(spec.types).length} |`,
    `| Methods | ${Object.keys(spec.methods).length} |`,
    `| Fields and parameters | ${countFields(spec)} |`,
    `| Enums | ${Object.keys(spec.enums).length} |`,
    `| Fields carrying extracted facts | ${Object.keys(spec.fields).length} |`,
    '',
  ];

  const entry = spec.changelog.find((candidate) => candidate.version === spec.version);
  if (entry !== undefined) {
    lines.push(`## What Telegram changed in ${entry.version}`, '');
    for (const group of entry.groups) {
      if (group.title.length > 0) {
        lines.push(`**${group.title}**`, '');
      }
      lines.push(...group.changes.map((change) => `- ${change}`), '');
    }
  }

  console.log(lines.join('\n'));
}

/** `--tag v10.3.0` names the tag the links should point at. */
function taggedAs(): string | undefined {
  const at = process.argv.indexOf(TAG_FLAG);
  return at < 0 ? undefined : process.argv[at + 1];
}

function countFields(spec: Spec): number {
  return [...Object.values(spec.types), ...Object.values(spec.methods)].reduce(
    (total, entity) => total + (entity.fields?.length ?? 0),
    0,
  );
}

try {
  await releaseNotes();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
