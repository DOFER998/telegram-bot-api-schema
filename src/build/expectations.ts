import { readFile, writeFile } from 'node:fs/promises';
import { compareStrings } from '../ordering.ts';
import { serializeJson } from '../schema/json.ts';

/** How many of each category the last accepted build extracted. */
export type Expectations = Readonly<Record<string, number>>;

/** One category that came out smaller than it used to. */
export interface Shortfall {
  /** Name of the category. */
  readonly category: string;
  /** What the committed floor says. */
  readonly expected: number;
  /** What this build produced. */
  readonly actual: number;
}

/**
 * How far a category may fall before the build refuses to write.
 *
 * Telegram does remove things, so an exact floor would fail on every genuine
 * deletion and the check would be turned off within a month. A fifth is wider
 * than any real release and far narrower than a broken pattern, which does not
 * lose a few entries but nearly all of them.
 */
const TOLERANCE = 0.8;

/**
 * Compares what a build extracted against what the last accepted one did.
 *
 * This is the whole defence against the failure mode that comes with reading
 * prose: a pattern goes on matching nothing after Telegram rewrites a sentence,
 * the category quietly empties, and the specification keeps building and keeps
 * looking fine. Counting is the only signal that survives, because a pattern
 * that stopped working produces no error of its own.
 *
 * @param expectations the committed floor
 * @param actual what this build produced
 * @returns the categories that fell too far, empty when none did
 */
export function findShortfalls(
  expectations: Expectations,
  actual: Expectations,
): readonly Shortfall[] {
  return Object.entries(expectations)
    .flatMap(([category, expected]): Shortfall[] => {
      const found = actual[category] ?? 0;
      const floor = expected === 0 ? 0 : Math.max(1, Math.floor(expected * TOLERANCE));
      return found < floor ? [{ category, expected, actual: found }] : [];
    })
    .toSorted((left, right) => compareStrings(left.category, right.category));
}

/**
 * Categories this build produced that the floor has never seen.
 *
 * Not a failure — a new extractor is how the specification grows — but worth
 * printing, because the floor does not guard a category until it is recorded.
 *
 * @param expectations the committed floor
 * @param actual what this build produced
 */
export function findUnrecorded(
  expectations: Expectations,
  actual: Expectations,
): readonly string[] {
  return Object.keys(actual)
    .filter((category) => !Object.hasOwn(expectations, category))
    .toSorted(compareStrings);
}

/**
 * Reads the committed floor.
 *
 * @param file path to `data/expectations.json`
 * @returns the floor, empty when it has never been written
 */
export async function readExpectations(file: string): Promise<Expectations> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as Expectations;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

/**
 * Writes the floor.
 *
 * Only ever called by the command that accepts a new one, never by a build:
 * a floor a build could rewrite guards nothing.
 *
 * @param file path to `data/expectations.json`
 * @param counts what to record
 */
export async function writeExpectations(file: string, counts: Expectations): Promise<void> {
  await writeFile(file, serializeJson(counts), 'utf8');
}
