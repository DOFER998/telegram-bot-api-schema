import type { Spec, SpecEnum } from '../build/spec.ts';
import { compareStrings } from '../ordering.ts';

/** Which value of which field selects which subtype. */
export interface Discriminator {
  /** Name of the abstract type. */
  readonly abstract: string;
  /** Name of the field that tells the subtypes apart. */
  readonly field: string;
  /** Name of the enum holding the values. */
  readonly enumName: string;
  /** Value on the wire, keyed by subtype name. */
  readonly literals: Readonly<Record<string, string>>;
  /** Values that select more than one subtype, which a mapping cannot express. */
  readonly ambiguous: readonly string[];
}

/**
 * A discriminating value is pinned two ways, and both are needed: `always
 * “creator”` in the text, `must be <em>default</em>` only in the markup.
 */
const QUOTED = /“([^”]+)”/gu;
const EMPHASISED = /<em>([^<]+)<\/em>/gu;

/**
 * Recovers, for every abstract type, which value selects which subtype.
 *
 * The specification names the discriminating values but not which subtype each
 * selects; an OpenAPI `discriminator` needs the mapping. Recovered from the
 * field descriptions already in `spec.json`, and matched against the enum, so a
 * literal the enum does not know brings the build down.
 *
 * @param spec the specification
 * @returns one discriminator per abstract type that has one, ordered by name
 * @throws when an abstract type has an enum but no field accounting for every subtype
 */
export function recoverDiscriminators(spec: Spec): readonly Discriminator[] {
  return Object.values(spec.types)
    .filter((type) => type.subtypes !== undefined && type.subtypes.length > 0)
    .flatMap((type) => {
      const subtypes = type.subtypes ?? [];
      const candidates = Object.values(spec.enums).filter(
        (item) => item.href === type.href && item.name.startsWith(type.name),
      );

      return candidates.flatMap((item) => {
        const found = discriminate(spec, type.name, subtypes, item);
        return found === undefined ? [] : [found];
      });
    })
    .toSorted((left, right) => compareStrings(left.abstract, right.abstract));
}

/**
 * Finds the field whose value accounts for every subtype.
 *
 * Tries every shared field rather than guessing from the enum's name, which
 * would break the moment a field is renamed and the enum is not.
 */
function discriminate(
  spec: Spec,
  abstract: string,
  subtypes: readonly string[],
  item: SpecEnum,
): Discriminator | undefined {
  const values = new Set(item.values);
  const shared = commonFields(spec, subtypes);

  for (const field of shared) {
    const literals: Record<string, string> = {};
    const complete = subtypes.every((subtype) => {
      const value = quotedValue(spec, subtype, field, values);
      if (value === undefined) {
        return false;
      }
      literals[subtype] = value;
      return true;
    });

    if (complete) {
      const seen = new Map<string, number>();
      for (const value of Object.values(literals)) {
        seen.set(value, (seen.get(value) ?? 0) + 1);
      }
      return {
        abstract,
        field,
        enumName: item.name,
        literals,
        ambiguous: [...seen]
          .filter(([, count]) => count > 1)
          .map(([value]) => value)
          .toSorted(compareStrings),
      };
    }
  }

  throw new Error(
    `${abstract}: the enum ${item.name} names its discriminating values, but no field of every subtype carries them — the specification disagrees with itself`,
  );
}

function commonFields(spec: Spec, subtypes: readonly string[]): readonly string[] {
  const [first, ...rest] = subtypes;
  const names = (spec.types[first ?? '']?.fields ?? []).map((field) => field.name);
  return names.filter((name) =>
    rest.every((subtype) =>
      (spec.types[subtype]?.fields ?? []).some((field) => field.name === name),
    ),
  );
}

function quotedValue(
  spec: Spec,
  subtype: string,
  field: string,
  values: ReadonlySet<string>,
): string | undefined {
  const member = (spec.types[subtype]?.fields ?? []).find((candidate) => candidate.name === field);
  if (member === undefined) {
    return undefined;
  }
  const candidates = [
    ...[...member.description.matchAll(QUOTED)].map((match) => match[1] ?? ''),
    ...[...member.html_description.matchAll(EMPHASISED)].map((match) => match[1] ?? ''),
  ];
  return candidates.find((value) => values.has(value));
}
