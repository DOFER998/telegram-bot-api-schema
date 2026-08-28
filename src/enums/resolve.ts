import type { EnumDeclaration } from '#kit';
import type { Declarations } from '../declarations/load.ts';
import { memberName, pascalCase } from '../naming.ts';
import { compareStrings } from '../ordering.ts';
import type { ApiField, BotApiScrape } from '../schema/model.ts';
import type { Discriminator } from './discriminators.ts';
import type { EnumValue, ResolvedEnum } from './model.ts';

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/u;

/**
 * Assembles every enum.
 *
 * Discriminators of abstract types derive themselves; the other three
 * strategies come from declarations.
 *
 * @param scrape the parsed scrape
 * @param declarations the loaded declarations
 * @param discriminators discriminators of the abstract types
 * @returns enums ordered by name
 * @throws when a strategy yields no values or two names collide
 */
export function resolveEnums(
  schema: BotApiScrape,
  declarations: Declarations,
  discriminators: readonly Discriminator[],
): readonly ResolvedEnum[] {
  const resolved = [
    ...discriminators.map((discriminator) => fromDiscriminator(schema, discriminator)),
    ...declarations.enums.map((declaration) => fromDeclaration(schema, declaration)),
  ].toSorted((left, right) => compareStrings(left.name, right.name));

  assertUniqueNames(resolved);
  return resolved;
}

/** Name of the enum derived from a discriminator. */
export function discriminatorEnumName(abstract: string, field: string): string {
  return `${abstract}${pascalCase(field)}`;
}

function fromDiscriminator(schema: BotApiScrape, discriminator: Discriminator): ResolvedEnum {
  const { abstract, field, literals } = discriminator;
  const anchor = schema.types[abstract]?.anchor;
  return finish(
    discriminatorEnumName(abstract, field),
    `Values of the ${field} field that tell subtypes of ${abstract} apart.`,
    anchor,
    Object.values(literals),
  );
}

function fromDeclaration(schema: BotApiScrape, declaration: EnumDeclaration): ResolvedEnum {
  const { name, options } = declaration;

  if ('static' in options) {
    const values = Object.entries(options.static).map(([key, value]) => ({
      member: memberName(key),
      value,
    }));
    return complete(name, options.description ?? `Values accepted by ${name}.`, undefined, values);
  }

  if ('parse' in options) {
    const { entity, attribute, pattern } = options.parse;
    const member = memberOf(schema, entity, attribute);
    const anchor = schema.types[entity]?.anchor ?? schema.methods[entity]?.anchor;
    return finish(
      name,
      options.description ?? `Values accepted by ${entity}.${attribute}.`,
      anchor,
      capture(member.html_description, pattern),
    );
  }

  const source = schema.types[options.extract.from];
  const excluded = new Set(options.extract.exclude);
  return finish(
    name,
    options.description ?? `Field names of ${options.extract.from}.`,
    source?.anchor,
    (source?.fields ?? []).map((field) => field.name).filter((field) => !excluded.has(field)),
  );
}

function memberOf(schema: BotApiScrape, entity: string, attribute: string): ApiField {
  const members = schema.types[entity]?.fields ?? schema.methods[entity]?.parameters ?? [];
  const member = members.find((field) => field.name === attribute);
  if (member === undefined) {
    throw new Error(
      `An enum points at ${entity}.${attribute}, which the specification does not have`,
    );
  }
  return member;
}

/** Collects the first capturing group of every match, keeping order and dropping repeats. */
function capture(text: string, pattern: RegExp): string[] {
  const global = new RegExp(
    pattern.source,
    pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`,
  );
  const found = [...text.matchAll(global)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
  return [...new Set(found)];
}

/** Repeats are dropped here: subtypes of an abstract type may share one value. */
function finish(
  name: string,
  description: string,
  anchor: string | undefined,
  values: readonly string[],
): ResolvedEnum {
  return complete(
    name,
    description,
    anchor,
    [...new Set(values)].map((value) => ({ member: memberName(value), value })),
  );
}

function complete(
  name: string,
  description: string,
  anchor: string | undefined,
  values: readonly EnumValue[],
): ResolvedEnum {
  if (values.length === 0) {
    throw new Error(`Enum ${name}: the strategy yielded no values at all`);
  }
  const invalid = values.filter((value) => !IDENTIFIER.test(value.member));
  if (invalid.length > 0) {
    throw new Error(
      `Enum ${name}: the values ${invalid.map((v) => v.value).join(', ')} produce member names that are not identifiers`,
    );
  }
  const members = new Set(values.map((value) => value.member));
  if (members.size !== values.length) {
    throw new Error(`Enum ${name}: different values produce the same member name`);
  }
  return { name, description, values, ...(anchor === undefined ? {} : { anchor }) };
}

function assertUniqueNames(enums: readonly ResolvedEnum[]): void {
  const seen = new Set<string>();
  const clashing = enums.filter((item) => !seen.add(item.name)).map((item) => item.name);
  if (clashing.length > 0) {
    throw new Error(`Enum names repeat: ${[...new Set(clashing)].join(', ')}`);
  }
}
