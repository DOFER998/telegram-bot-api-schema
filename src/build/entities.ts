import { methodReturns } from '../declarations/effective.ts';
import type { Declarations } from '../declarations/load.ts';
import type { ApiField, ApiNote, BotApiScrape } from '../schema/model.ts';

/**
 * A field of a type or a parameter of a method.
 *
 * Deliberately the same four keys, with the same names and the same meanings,
 * that published specifications already use. Everything this project extracts
 * beyond them lives in its own section keyed by `Entity.field`, so a consumer
 * moving over reads the tables it already knows and opts into the rest.
 */
export interface SpecField {
  /** Name of the field or parameter. */
  readonly name: string;
  /** Types in the vocabulary of the documentation. */
  readonly types: readonly string[];
  /** Whether it must be supplied or is always present. */
  readonly required: boolean;
  /** Description as flat text. */
  readonly description: string;
  /** Description as source markup, which is where marked-up values survive. */
  readonly html_description: string;
}

/** A Bot API type. */
export interface SpecType {
  /** Name of the type. */
  readonly name: string;
  /** Address of the section describing it. */
  readonly href: string;
  /** Description, one entry per paragraph. */
  readonly description: readonly string[];
  /** Fields in documentation order. */
  readonly fields?: readonly SpecField[];
  /** Names of the types this one stands for. */
  readonly subtypes?: readonly string[];
  /** Names of the abstract types this one is a case of. */
  readonly subtype_of?: readonly string[];
  /** Prose attached to the type but outside its table. */
  readonly notes?: readonly ApiNote[];
}

/** A Bot API method. */
export interface SpecMethod {
  /** Name of the method. */
  readonly name: string;
  /** Address of the section describing it. */
  readonly href: string;
  /** Description, one entry per paragraph. */
  readonly description: readonly string[];
  /** Return types in the vocabulary of the documentation. */
  readonly returns: readonly string[];
  /** Parameters in documentation order. */
  readonly fields?: readonly SpecField[];
  /** Prose attached to the method but outside its table. */
  readonly notes?: readonly ApiNote[];
}

/**
 * Builds the type and method sections.
 *
 * `subtype_of` is derived rather than scraped: the documentation states the
 * relation only downwards, from the abstract type to its cases, and a consumer
 * holding one case has no way back up without walking every abstract type.
 *
 * @param scrape the parsed scrape
 * @param declarations the loaded declarations
 * @param docsUrl address of the documentation page, which the anchors hang off
 * @returns both sections, keyed by name
 */
export function buildEntities(
  scrape: BotApiScrape,
  declarations: Declarations,
  docsUrl: string,
): {
  readonly types: Readonly<Record<string, SpecType>>;
  readonly methods: Readonly<Record<string, SpecMethod>>;
} {
  const parents = parentsOf(scrape);

  const types = Object.fromEntries(
    Object.values(scrape.types).map((type): [string, SpecType] => {
      const parent = parents[type.name];
      return [
        type.name,
        {
          name: type.name,
          href: `${docsUrl}#${type.anchor}`,
          description: paragraphs(type.description),
          ...(type.fields === undefined ? {} : { fields: type.fields.map(toField) }),
          ...(type.subtypes === undefined ? {} : { subtypes: type.subtypes }),
          ...(parent === undefined ? {} : { subtype_of: parent }),
          ...(type.notes === undefined ? {} : { notes: type.notes }),
        },
      ];
    }),
  );

  const methods = Object.fromEntries(
    Object.values(scrape.methods).map((method): [string, SpecMethod] => [
      method.name,
      {
        name: method.name,
        href: `${docsUrl}#${method.anchor}`,
        description: paragraphs(method.description),
        returns: methodReturns(method, declarations) ?? [],
        ...(method.parameters === undefined ? {} : { fields: method.parameters.map(toField) }),
        ...(method.notes === undefined ? {} : { notes: method.notes }),
      },
    ]),
  );

  return { types, methods };
}

function parentsOf(scrape: BotApiScrape): Readonly<Record<string, readonly string[]>> {
  const parents: Record<string, string[]> = {};
  for (const type of Object.values(scrape.types)) {
    for (const subtype of type.subtypes ?? []) {
      const siblings = parents[subtype] ?? [];
      siblings.push(type.name);
      parents[subtype] = siblings;
    }
  }
  return parents;
}

function toField(field: ApiField): SpecField {
  return {
    name: field.name,
    types: field.types,
    required: field.required,
    description: field.description,
    html_description: field.html_description,
  };
}

/** The scrape joins paragraphs with a blank line; published specifications keep them apart. */
function paragraphs(description: string): readonly string[] {
  return description.split('\n\n').filter((paragraph) => paragraph.length > 0);
}
