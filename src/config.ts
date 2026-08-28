import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../schema.config.ts';

/** Where the published files are served from. */
export interface RepositoryCoordinates {
  /** GitHub account or organisation. */
  readonly owner: string;
  /** Repository name. */
  readonly name: string;
  /** Branch the raw links point at. */
  readonly branch: string;
}

/** Settings as they are written in `schema.config.ts`. */
export interface SchemaConfig {
  /** Address of the Telegram Bot API documentation page. The only address the build reads. */
  readonly docsUrl: string;
  /** Coordinates of this repository, from which every published raw URL is derived. */
  readonly repository: RepositoryCoordinates;
}

/**
 * The four files a consumer fetches by raw URL.
 *
 * They sit at the root of the repository and their names are a public contract:
 * a raw link has no redirect, so renaming one of these breaks every consumer at
 * once and silently. Nothing here may be renamed, ever.
 */
export interface PublishedPaths {
  /** The specification. */
  readonly spec: string;
  /** JSON Schema describing the format of the specification itself. */
  readonly schema: string;
  /** The same API as an OpenAPI 3.1 document, for the generators that read one. */
  readonly openapi: string;
  /** Bot API version and release date, one field per line. */
  readonly version: string;
}

/** Settings with every relative path expanded to an absolute one. */
export interface ResolvedConfig {
  /** Root of the repository. */
  readonly root: string;
  /** Address of the Telegram Bot API documentation page. */
  readonly docsUrl: string;
  /**
   * Base every published raw URL hangs off, without a trailing slash.
   *
   * The single source of these addresses. `README.md` and the `$id` of
   * `schema.json` are checked against it rather than trusted to agree.
   */
  readonly rawBaseUrl: string;
  /** The scrape of the page — output of `scrape`, input of `build`. */
  readonly scrapeFile: string;
  /** Directory of type and method declarations, one flat file per entity: `<Name>.ts`. */
  readonly declarationsDir: string;
  /** Directory of enum declarations: `<Name>.ts`. */
  readonly enumsDir: string;
  /** Expected extraction counts, the floor that guards against a silent parser failure. */
  readonly expectationsFile: string;
  /** The files a consumer fetches by raw URL. */
  readonly published: PublishedPaths;
}

const root = fileURLToPath(new URL('..', import.meta.url));

const RAW_HOST = 'https://raw.githubusercontent.com';

/**
 * Builds the address the published files are fetched from.
 *
 * @param repository coordinates from the config
 * @returns the base URL, without a trailing slash
 */
export function rawBaseUrl(repository: RepositoryCoordinates): string {
  return `${RAW_HOST}/${repository.owner}/${repository.name}/${repository.branch}`;
}

const DATA_DIR = 'data';

/** Reads `schema.config.ts` and expands the relative paths into absolute ones. */
export function loadConfig(): ResolvedConfig {
  const data = (...parts: string[]): string => resolve(root, DATA_DIR, ...parts);
  const published = (name: string): string => resolve(root, name);

  return {
    root,
    docsUrl: config.docsUrl,
    rawBaseUrl: rawBaseUrl(config.repository),
    scrapeFile: data('scrape.json'),
    declarationsDir: data('declarations'),
    enumsDir: data('enums'),
    expectationsFile: data('expectations.json'),
    published: {
      spec: published('spec.json'),
      schema: published('schema.json'),
      openapi: published('openapi.json'),
      version: published('VERSION'),
    },
  };
}
