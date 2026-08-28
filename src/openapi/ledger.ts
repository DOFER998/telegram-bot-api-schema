import { compareStrings } from '../ordering.ts';

/** Where the facts of one category ended up. */
export interface CategoryTally {
  /** How many the specification holds. */
  readonly total: number;
  /** How many became ordinary OpenAPI or JSON Schema keywords. */
  readonly standard: number;
  /** How many became `x-` extensions. */
  readonly extended: number;
  /** How many went nowhere. */
  readonly lost: number;
}

/**
 * Counts every fact of the specification and where the OpenAPI document put it.
 *
 * A translation is where things go missing quietly. A field constraint that no
 * keyword covers, a note nobody carried over, an enum nothing refers to — none
 * of that fails, and none of it is visible in a document that is otherwise
 * valid. So the facts are counted on the way in and on the way out, and a
 * difference stops the build.
 */
export class Ledger {
  readonly #totals: Map<string, number> = new Map();
  readonly #standard: Map<string, number> = new Map();
  readonly #extended: Map<string, number> = new Map();

  /** Records how many facts of a category the specification holds. */
  expect(category: string, count: number): void {
    this.#totals.set(category, (this.#totals.get(category) ?? 0) + count);
  }

  /** Records facts carried into ordinary OpenAPI fields. */
  standard(category: string, count: number): void {
    this.#standard.set(category, (this.#standard.get(category) ?? 0) + count);
  }

  /** Records facts carried into `x-` extensions. */
  extended(category: string, count: number): void {
    this.#extended.set(category, (this.#extended.get(category) ?? 0) + count);
  }

  /**
   * The tally per category, ordered by name.
   *
   * A category that was carried but never expected counts as expected: it is a
   * fact the document holds, and the point of the ledger is that nothing goes
   * missing, not that nothing is added.
   */
  tally(): Readonly<Record<string, CategoryTally>> {
    const names = [
      ...new Set([...this.#totals.keys(), ...this.#standard.keys(), ...this.#extended.keys()]),
    ].toSorted(compareStrings);

    const result: Record<string, CategoryTally> = {};
    for (const name of names) {
      const standard = this.#standard.get(name) ?? 0;
      const extended = this.#extended.get(name) ?? 0;
      const total = Math.max(this.#totals.get(name) ?? 0, standard + extended);
      result[name] = { total, standard, extended, lost: total - standard - extended };
    }
    return result;
  }

  /** Categories that lost facts, ordered by name. */
  losses(): readonly { readonly category: string; readonly lost: number }[] {
    return Object.entries(this.tally())
      .filter(([, counts]) => counts.lost > 0)
      .map(([category, counts]) => ({ category, lost: counts.lost }));
  }
}
