import { compareStrings } from '../ordering.ts';
import type { Spec } from './spec.ts';

/** A name the specification refers to that the specification does not define. */
export interface BrokenLink {
  /** Where the reference sits, written as a path into the specification. */
  readonly at: string;
  /** The name it points at. */
  readonly target: string;
  /** What kind of thing that name was expected to be. */
  readonly expected: 'type' | 'method' | 'field' | 'enum';
}

/** Scalars the documentation names in a type column that are not types of the specification. */
const PRIMITIVES: ReadonlySet<string> = new Set([
  'Boolean',
  'False',
  'Float',
  'Float number',
  'Int',
  'Integer',
  'String',
  'True',
]);

const ARRAY_PREFIX = 'Array of ';

/**
 * Strips every `Array of` from a type, not just the first.
 *
 * A keyboard is an `Array of Array of InlineKeyboardButton`, and stripping one
 * prefix leaves `Array of InlineKeyboardButton`, which names no type. Five
 * fields are shaped that way.
 */
function elementType(target: string): string {
  let element = target;
  while (element.startsWith(ARRAY_PREFIX)) {
    element = element.slice(ARRAY_PREFIX.length);
  }
  return element;
}

/**
 * Checks that every name the specification uses is a name it defines.
 *
 * No other check catches a dangling edge: the schema only says a type name is a
 * string, and a string naming nothing is still a string.
 *
 * @param spec the assembled specification
 * @returns every broken reference, ordered by where it sits
 */
export function findBrokenLinks(spec: Spec): readonly BrokenLink[] {
  const known = {
    types: new Set(Object.keys(spec.types)),
    methods: new Set(Object.keys(spec.methods)),
  };

  return [
    ...typeLinks(spec, known.types),
    ...methodLinks(spec, known.types),
    ...enumLinks(spec),
    ...factLinks(spec, known),
  ].toSorted((left, right) => compareStrings(left.at, right.at));
}

/** A type column names a type, an array of one, or a scalar the documentation writes in prose. */
function unknownType(at: string, declared: string, types: ReadonlySet<string>): BrokenLink[] {
  const element = elementType(declared);
  return PRIMITIVES.has(element) || types.has(element)
    ? []
    : [{ at, target: element, expected: 'type' }];
}

function typeLinks(spec: Spec, types: ReadonlySet<string>): BrokenLink[] {
  return Object.values(spec.types).flatMap((type) => [
    ...(type.fields ?? []).flatMap((field) =>
      field.types.flatMap((declared) =>
        unknownType(`types.${type.name}.fields.${field.name}`, declared, types),
      ),
    ),
    ...(type.subtypes ?? [])
      .filter((subtype) => !types.has(subtype))
      .map(
        (subtype): BrokenLink => ({
          at: `types.${type.name}.subtypes`,
          target: subtype,
          expected: 'type',
        }),
      ),
    ...(type.subtype_of ?? [])
      .filter((parent) => !types.has(parent))
      .map(
        (parent): BrokenLink => ({
          at: `types.${type.name}.subtype_of`,
          target: parent,
          expected: 'type',
        }),
      ),
  ]);
}

function methodLinks(spec: Spec, types: ReadonlySet<string>): BrokenLink[] {
  return Object.values(spec.methods).flatMap((method) => [
    ...(method.fields ?? []).flatMap((field) =>
      field.types.flatMap((declared) =>
        unknownType(`methods.${method.name}.fields.${field.name}`, declared, types),
      ),
    ),
    ...method.returns.flatMap((returned) =>
      unknownType(`methods.${method.name}.returns`, returned, types),
    ),
  ]);
}

function enumLinks(spec: Spec): BrokenLink[] {
  return Object.values(spec.enums).flatMap((item) =>
    (item.applies_to ?? [])
      .filter((site) => !hasMember(spec, site))
      .map(
        (site): BrokenLink => ({
          at: `enums.${item.name}.applies_to`,
          target: site,
          expected: 'field',
        }),
      ),
  );
}

function factLinks(
  spec: Spec,
  known: { readonly types: ReadonlySet<string>; readonly methods: ReadonlySet<string> },
): BrokenLink[] {
  return Object.entries(spec.fields).flatMap(([key, facts]) => [
    ...(hasMember(spec, key)
      ? []
      : [{ at: `fields.${key}`, target: key, expected: 'field' as const }]),
    ...(facts.returned_only_in ?? [])
      .filter((method) => !known.methods.has(method))
      .map(
        (method): BrokenLink => ({
          at: `fields.${key}.returned_only_in`,
          target: method,
          expected: 'method',
        }),
      ),
    ...(facts.implies_set ?? [])
      .filter((sibling) => !hasMember(spec, `${facts.entity}.${sibling}`))
      .map(
        (sibling): BrokenLink => ({
          at: `fields.${key}.implies_set`,
          target: `${facts.entity}.${sibling}`,
          expected: 'field',
        }),
      ),
    ...(facts.default_type !== undefined && !known.types.has(facts.default_type)
      ? [
          {
            at: `fields.${key}.default_type`,
            target: facts.default_type,
            expected: 'type' as const,
          },
        ]
      : []),
  ]);
}

/**
 * Counts every edge the check follows, so a check that silently stops looking
 * can be told from a specification that has nothing wrong with it.
 *
 * @param spec the assembled specification
 */
export function countLinks(spec: Spec): number {
  let total = 0;
  for (const type of Object.values(spec.types)) {
    total += (type.fields ?? []).reduce((sum, field) => sum + field.types.length, 0);
    total += (type.subtypes ?? []).length + (type.subtype_of ?? []).length;
  }
  for (const method of Object.values(spec.methods)) {
    total += (method.fields ?? []).reduce((sum, field) => sum + field.types.length, 0);
    total += method.returns.length;
  }
  for (const item of Object.values(spec.enums)) {
    total += (item.applies_to ?? []).length;
  }
  for (const facts of Object.values(spec.fields)) {
    total += 1 + (facts.returned_only_in ?? []).length + (facts.implies_set ?? []).length;
    total += facts.default_type === undefined ? 0 : 1;
  }
  return total;
}

/** `Entity.field` names a field of a type or a parameter of a method. */
function hasMember(spec: Spec, site: string): boolean {
  const separator = site.lastIndexOf('.');
  const owner = site.slice(0, separator);
  const field = site.slice(separator + 1);
  const members = spec.types[owner]?.fields ?? spec.methods[owner]?.fields;
  return members?.some((member) => member.name === field) ?? false;
}
