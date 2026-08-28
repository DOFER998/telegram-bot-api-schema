import { compareStrings } from '../ordering.ts';
import type { ApiField, BotApiScrape } from '../schema/model.ts';

/** The field whose value tells the subtypes of an abstract type apart. */
export interface Discriminator {
  /** Name of the abstract type. */
  readonly abstract: string;
  /** Name of the discriminating field. */
  readonly field: string;
  /** Value of the field on each subtype, keyed by subtype name. */
  readonly literals: Readonly<Record<string, string>>;
}

const ALWAYS = /always\s+[“"]([^”"]+)[”"]/u;
const MUST_BE = /must be <em>([^<]+)<\/em>/u;

/**
 * Finds the discriminators of every abstract type.
 *
 * A discriminator is a field whose value is pinned on every subtype without
 * exception — `always “creator”` on what Telegram sends, `must be
 * <em>animation</em>` on what it accepts.
 *
 * Repeated values are allowed: two `InlineQueryResult` subtypes both declare
 * `type` as `audio`, and narrowing simply leaves two candidates.
 *
 * @param schema the parsed scrape
 * @returns discriminators ordered by abstract type name
 */
export function findDiscriminators(schema: BotApiScrape): readonly Discriminator[] {
  return Object.values(schema.types)
    .filter((type) => type.subtypes !== undefined)
    .toSorted((left, right) => compareStrings(left.name, right.name))
    .flatMap((type) => {
      const subtypes = type.subtypes ?? [];
      const literalsBySubtype = subtypes.map((subtype) => literalFields(schema, subtype));
      const candidate = commonFields(literalsBySubtype)
        .toSorted(
          (left, right) =>
            distinctCount(literalsBySubtype, right) - distinctCount(literalsBySubtype, left) ||
            compareStrings(left, right),
        )
        .at(0);

      if (candidate === undefined) {
        return [];
      }
      const literals: Record<string, string> = {};
      subtypes.forEach((subtype, index) => {
        literals[subtype] = literalsBySubtype[index]?.[candidate] ?? '';
      });
      return [{ abstract: type.name, field: candidate, literals }];
    });
}

function literalFields(schema: BotApiScrape, typeName: string): Record<string, string> {
  const fields = schema.types[typeName]?.fields ?? [];
  const literals: Record<string, string> = {};
  for (const field of fields) {
    const value = fixedValue(field);
    if (value !== undefined) {
      literals[field.name] = value;
    }
  }
  return literals;
}

function fixedValue(field: ApiField): string | undefined {
  const match = ALWAYS.exec(field.html_description) ?? MUST_BE.exec(field.html_description);
  return match?.[1];
}

function commonFields(literalsBySubtype: readonly Record<string, string>[]): string[] {
  const [first, ...rest] = literalsBySubtype;
  if (first === undefined) {
    return [];
  }
  return Object.keys(first).filter((field) => rest.every((fields) => field in fields));
}

/** The more distinct values a field has, the better it divides the subtypes. */
function distinctCount(
  literalsBySubtype: readonly Record<string, string>[],
  field: string,
): number {
  return new Set(literalsBySubtype.map((literals) => literals[field])).size;
}
