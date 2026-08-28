import type { SchemaConfig } from './src/config.ts';

/**
 * Settings of the specification builder.
 *
 * Two things live here and nothing else does: the one page everything is read
 * from, and the coordinates the published files are served under.
 *
 * The coordinates are here rather than written into `README.md` and
 * `schema.json` separately because a raw GitHub URL has no redirect. Once the
 * first release is tagged those addresses are a public contract, and a copy that
 * can drift is a copy that eventually will. `bun run check` fails if any file
 * disagrees with what is written here.
 */
const config: SchemaConfig = {
  docsUrl: 'https://core.telegram.org/bots/api',
  repository: {
    owner: 'DOFER998',
    name: 'telegram-bot-api-schema',
    branch: 'main',
  },
};

export default config;
