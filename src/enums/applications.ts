import type { EnumDeclaration } from '#kit';
import type { Declarations } from '../declarations/load.ts';
import { compareStrings } from '../ordering.ts';
import type { ApiField, BotApiScrape } from '../schema/model.ts';

/** Which enum types a member of the API, keyed by `Entity.field`. */
export type EnumApplications = Readonly<Record<string, string>>;

const ANY_ENTITY = '*';

/**
 * Works out which member of the API each enum types.
 *
 * A `parse` strategy already names the field its values were read from, and that
 * field is typed without the declaration repeating itself. Everything else comes
 * from `applies`.
 *
 * @param schema the parsed schema
 * @param declarations the loaded declarations
 * @returns enum name per `Entity.field`
 */
export function resolveApplications(
  schema: BotApiScrape,
  declarations: Declarations,
): EnumApplications {
  const applications: Record<string, string> = {};
  for (const declaration of declarations.enums) {
    for (const site of sitesOf(schema, declaration)) {
      applications[site] = declaration.name;
    }
  }
  return applications;
}

/**
 * Reports the enum applications that no longer describe anything.
 *
 * @param schema the parsed schema
 * @param declarations the loaded declarations
 * @returns a list of complaints; empty means every pattern still matches
 */
export function checkApplications(
  schema: BotApiScrape,
  declarations: Declarations,
): readonly string[] {
  const claimed: Record<string, string> = {};
  const complaints: string[] = [];

  for (const declaration of declarations.enums) {
    for (const pattern of declaration.options.applies ?? []) {
      const matched = expand(schema, pattern);
      if (matched.length === 0) {
        complaints.push(`${declaration.name} — the pattern ${pattern} matches nothing`);
      }
      for (const site of matched) {
        const owner = claimed[site];
        if (owner !== undefined && owner !== declaration.name) {
          complaints.push(`${site} — claimed by both ${owner} and ${declaration.name}`);
        }
        claimed[site] = declaration.name;
      }
    }
  }
  return complaints;
}

function sitesOf(schema: BotApiScrape, declaration: EnumDeclaration): string[] {
  const declared = (declaration.options.applies ?? []).flatMap((pattern) =>
    expand(schema, pattern),
  );
  const parsed =
    'parse' in declaration.options
      ? [`${declaration.options.parse.entity}.${declaration.options.parse.attribute}`]
      : [];
  return [...new Set([...parsed, ...declared])].toSorted(compareStrings);
}

/** `Entity.field` names one member; `*.field` names every entity carrying that field. */
function expand(schema: BotApiScrape, pattern: string): string[] {
  const separator = pattern.lastIndexOf('.');
  const owner = pattern.slice(0, separator);
  const field = pattern.slice(separator + 1);

  if (owner !== ANY_ENTITY) {
    return membersOf(schema, owner).some((member) => member.name === field) ? [pattern] : [];
  }
  return entities(schema)
    .filter(([, members]) => members.some((member) => member.name === field))
    .map(([name]) => `${name}.${field}`)
    .toSorted(compareStrings);
}

function entities(schema: BotApiScrape): [string, readonly ApiField[]][] {
  return [
    ...Object.values(schema.types).map((type): [string, readonly ApiField[]] => [
      type.name,
      type.fields ?? [],
    ]),
    ...Object.values(schema.methods).map((method): [string, readonly ApiField[]] => [
      method.name,
      method.parameters ?? [],
    ]),
  ];
}

function membersOf(schema: BotApiScrape, entity: string): readonly ApiField[] {
  return schema.types[entity]?.fields ?? schema.methods[entity]?.parameters ?? [];
}
