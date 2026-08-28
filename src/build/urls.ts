import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import type { ResolvedConfig } from '../config.ts';

/**
 * The README publishes one address per file plus a pinned example, and
 * `schema.json` names itself. Finding none at all means the README stopped
 * telling anybody where to fetch this, which no other check would notice.
 */
export const FEWEST_ADDRESSES = 4;

/** A published address that disagrees with the one the config derives. */
export interface StrayUrl {
  /** File the address was found in, relative to the repository root. */
  readonly file: string;
  /** The address as written there. */
  readonly url: string;
}

/**
 * Every raw address on the host, wherever it is written.
 *
 * Deliberately matches the host and not the configured base: an address that
 * points at the wrong repository is exactly what this looks for, so it cannot
 * be found by searching for the right one.
 */
const RAW_URL = /https:\/\/raw\.githubusercontent\.com\/[^\s)"'`<>]+/gu;

/** The ref is the last segment of the base: dropping it leaves the repository. */
const REF = /\/[^/]+$/u;

/**
 * Checks that every published address agrees with the repository coordinates.
 *
 * A raw GitHub URL has no redirect, so once a release is tagged these addresses
 * are a contract that cannot be corrected — a consumer that fetched the wrong
 * one simply gets a 404 forever. Writing them in one place is only half of it;
 * this is the half that keeps a copy in `README.md` or in the `$id` of
 * `schema.json` from quietly disagreeing with it.
 *
 * @param config engine settings
 * @param files paths to search
 * @returns addresses pointing somewhere other than this repository
 */
export async function findStrayUrls(
  config: ResolvedConfig,
  files: readonly string[],
): Promise<readonly StrayUrl[]> {
  const stray: StrayUrl[] = [];

  for (const file of files) {
    const raw = await readFile(file, 'utf8').catch(() => undefined);
    if (raw === undefined) {
      continue;
    }
    for (const [url] of decoded(raw).matchAll(RAW_URL)) {
      if (!belongsHere(url, config.rawBaseUrl)) {
        stray.push({ file: relative(config.root, file), url });
      }
    }
  }
  return stray;
}

/**
 * Counts the addresses checked, so a check that stopped finding any can be told
 * from a repository with none left to find.
 *
 * @param files paths to search
 */
export async function countUrls(files: readonly string[]): Promise<number> {
  let total = 0;
  for (const file of files) {
    const raw = await readFile(file, 'utf8').catch(() => undefined);
    total += raw === undefined ? 0 : [...decoded(raw).matchAll(RAW_URL)].length;
  }
  return total;
}

/**
 * Percent-decodes the text before scanning it.
 *
 * A shields.io badge carries the address it reads as a query parameter, so it
 * arrives as `https%3A%2F%2Fraw.githubusercontent.com%2F…` and an undecoded
 * scan walks straight past it — which is how a badge would keep pointing at the
 * previous owner after a move, with nothing to catch it.
 */
function decoded(text: string): string {
  return `${text}\n${text.replace(/%[0-9A-Fa-f]{2}/gu, (byte) => decodeURIComponent(byte))}`;
}

/**
 * An address belongs here when it names this repository, at any ref.
 *
 * The branch is not required to match: `.../v10.3.0/spec.json` is the same
 * contract pinned to a release, and the README offers exactly that.
 */
function belongsHere(url: string, base: string): boolean {
  return url.startsWith(`${base.replace(REF, '')}/`);
}
