import type { EnumDeclaration, MethodDeclaration, TypeDeclaration } from '#kit';
import { checkApplications } from '../enums/applications.ts';
import type { ApiField, BotApiScrape } from '../schema/model.ts';
import { knownTypeNames, methodReturns } from './effective.ts';
import type { Declarations } from './load.ts';

/**
 * Checks the declarations against the documentation.
 *
 * A declaration survives regeneration, so over time it drifts away from the
 * documentation: Telegram renames a field and a marker now points at nothing.
 * Such a mismatch has to bring the stage down rather than quietly disappear
 * from the specification.
 *
 * @param scrape the parsed scrape
 * @param declarations the loaded declarations
 * @returns a list of complaints; empty means everything lines up
 */
export function validateDeclarations(
  scrape: BotApiScrape,
  declarations: Declarations,
): readonly string[] {
  const knownTypes = knownTypeNames(scrape);
  return [
    ...Object.values(declarations.types).flatMap((declaration) => checkType(scrape, declaration)),
    ...Object.values(declarations.methods).flatMap((declaration) =>
      checkMethod(scrape, declaration),
    ),
    ...declarations.enums.flatMap((declaration) => checkEnum(scrape, declaration)),
    ...checkApplications(scrape, declarations),
    ...checkReturnsAreKnown(scrape, declarations, knownTypes),
  ];
}

function checkType(scrape: BotApiScrape, declaration: TypeDeclaration): string[] {
  const { name, options } = declaration;
  const type = scrape.types[name];
  if (type === undefined) {
    return [`${name} — the documentation has no such type, the declaration is stale`];
  }
  return checkSemantics(name, options.semantics, type.fields ?? []);
}

function checkMethod(scrape: BotApiScrape, declaration: MethodDeclaration): string[] {
  const { name, options } = declaration;
  const method = scrape.methods[name];
  if (method === undefined) {
    return [`${name} — the documentation has no such method, the declaration is stale`];
  }
  return checkSemantics(name, options.semantics, method.parameters ?? []);
}

function checkSemantics(
  owner: string,
  semantics: Readonly<Record<string, string>> | undefined,
  members: readonly ApiField[],
): string[] {
  const names = new Set(members.map((member) => member.name));
  return Object.keys(semantics ?? {})
    .filter((member) => !names.has(member))
    .map(
      (member) => `${owner}.${member} — the documentation has no such field, the marker is stale`,
    );
}

/** Every method has to end up with a return type: a silent gap surfaces only at build time. */
function checkReturnsAreKnown(
  scrape: BotApiScrape,
  declarations: Declarations,
  knownTypes: ReadonlySet<string>,
): string[] {
  return Object.values(scrape.methods).flatMap((method) => {
    const returns = methodReturns(method, declarations);
    if (returns === undefined || returns.length === 0) {
      return [
        `${method.name} — the return type was not parsed from the prose and no declaration supplies it`,
      ];
    }
    return returns
      .filter((type) => !isKnownReturn(type, knownTypes))
      .map((type) => `${method.name} — the declared return type ${type} is unknown`);
  });
}

const RETURN_PRIMITIVES: ReadonlySet<string> = new Set([
  'Boolean',
  'False',
  'Float',
  'Int',
  'Integer',
  'String',
  'True',
]);

const ARRAY_PREFIX = 'Array of ';

function isKnownReturn(type: string, knownTypes: ReadonlySet<string>): boolean {
  const element = type.startsWith(ARRAY_PREFIX) ? type.slice(ARRAY_PREFIX.length) : type;
  return RETURN_PRIMITIVES.has(element) || knownTypes.has(element);
}

function checkEnum(scrape: BotApiScrape, declaration: EnumDeclaration): string[] {
  const { name, options } = declaration;
  if (scrape.types[name] !== undefined) {
    return [`${name} — the enum name is taken by a type of the documentation`];
  }

  if ('parse' in options) {
    const { entity, attribute } = options.parse;
    const members = membersOf(scrape, entity);
    if (members === undefined) {
      return [`${name} — the documentation has no entity ${entity}`];
    }
    return members.some((member) => member.name === attribute)
      ? []
      : [`${name} — ${entity} has no field ${attribute}`];
  }

  if ('extract' in options) {
    const source = scrape.types[options.extract.from];
    if (source === undefined) {
      return [`${name} — the documentation has no type ${options.extract.from}`];
    }
    const fields = new Set((source.fields ?? []).map((field) => field.name));
    return options.extract.exclude
      .filter((field) => !fields.has(field))
      .map(
        (field) =>
          `${name} — ${options.extract.from}.${field} is excluded but no such field exists`,
      );
  }

  return [];
}

function membersOf(scrape: BotApiScrape, entity: string): readonly ApiField[] | undefined {
  return scrape.types[entity]?.fields ?? scrape.methods[entity]?.parameters;
}
