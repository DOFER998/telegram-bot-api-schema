import type { SpecField, SpecType } from '../build/entities.ts';
import type { Spec } from '../build/spec.ts';

import type { Discriminator } from './discriminators.ts';
import type { Ledger } from './ledger.ts';
import { applyFacts, enumsBySite, type JsonSchema, schemaForColumn } from './types.ts';

/**
 * Builds `components.schemas` from the types and enums.
 *
 * An abstract type becomes `oneOf` with a `discriminator`. A value selecting two
 * subtypes cannot appear in a mapping twice: the first wins and the collision is
 * recorded as an extension rather than silently resolved.
 *
 * @param spec the specification
 * @param discriminators the recovered value-to-subtype mappings
 * @param ledger records where every fact went
 * @returns the schemas, keyed by name
 */
export function buildSchemas(
  spec: Spec,
  discriminators: readonly Discriminator[],
  ledger: Ledger,
): Readonly<Record<string, JsonSchema>> {
  const schemas: Record<string, JsonSchema> = {};
  const byAbstract = new Map(discriminators.map((item) => [item.abstract, item]));
  const pinned = pinnedValues(discriminators);
  const enumSites = enumsBySite(spec);

  for (const type of Object.values(spec.types)) {
    schemas[type.name] = schemaForEntityType(
      spec,
      type,
      byAbstract.get(type.name),
      enumSites,
      pinned.get(type.name),
      ledger,
    );
    ledger.standard('types', 1);
  }

  for (const item of Object.values(spec.enums)) {
    schemas[item.name] = {
      type: 'string',
      enum: item.values,
      // Generators name a member after its value, and six of these values are
      // emoji. Left to itself the TypeScript generator emits `DiceEmoji.🎲`,
      // which is not an identifier, and the client does not compile. This is the
      // extension generators read to be told otherwise.
      'x-enum-varnames': item.members,
      description: item.description,
      ...(item.href === undefined ? {} : { externalDocs: { url: item.href } }),
    };
    ledger.standard('enums', 1);
    ledger.standard('enum_values', item.values.length);
  }

  return schemas;
}

/**
 * The value each subtype pins its discriminating field to.
 *
 * A `oneOf` with a `discriminator` only narrows if each branch says which value
 * it is. Without it a generated client has a sum type it can build but cannot
 * take apart, which is most of the point of having one.
 */
function pinnedValues(
  discriminators: readonly Discriminator[],
): ReadonlyMap<string, { readonly field: string; readonly value: string }> {
  const pinned = new Map<string, { field: string; value: string }>();
  for (const item of discriminators) {
    for (const [subtype, value] of Object.entries(item.literals)) {
      pinned.set(subtype, { field: item.field, value });
    }
  }
  return pinned;
}

function schemaForEntityType(
  spec: Spec,
  type: SpecType,
  discriminator: Discriminator | undefined,
  enumSites: Readonly<Record<string, string>>,
  pinned: { readonly field: string; readonly value: string } | undefined,
  ledger: Ledger,
): JsonSchema {
  const described = {
    description: type.description.join('\n\n'),
    externalDocs: { url: type.href },
    ...(type.notes === undefined ? {} : { 'x-telegram-notes': type.notes }),
    ...(type.subtype_of === undefined ? {} : { 'x-telegram-subtype-of': type.subtype_of }),
  };
  if (type.notes !== undefined) {
    ledger.extended('notes', type.notes.length);
  }
  if (type.subtype_of !== undefined) {
    ledger.extended('abstract_links', type.subtype_of.length);
  }

  if (type.subtypes !== undefined && type.subtypes.length > 0) {
    ledger.standard('abstract_links', type.subtypes.length);
    return {
      ...described,
      oneOf: type.subtypes.map((subtype) => ({ $ref: `#/components/schemas/${subtype}` })),
      ...(discriminator === undefined ? {} : discriminatorOf(discriminator, ledger)),
    };
  }

  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const field of type.fields ?? []) {
    const schema = schemaForField(spec, type.name, field, enumSites, ledger);
    properties[field.name] =
      pinned !== undefined && pinned.field === field.name
        ? { ...schema, const: pinned.value }
        : schema;
    if (field.required) {
      required.push(field.name);
    }
  }

  return {
    type: 'object',
    ...described,
    ...(Object.keys(properties).length === 0 ? {} : { properties }),
    ...(required.length === 0 ? {} : { required }),
  };
}

function discriminatorOf(discriminator: Discriminator, ledger: Ledger): JsonSchema {
  const mapping: Record<string, string> = {};
  for (const [subtype, value] of Object.entries(discriminator.literals)) {
    if (!Object.hasOwn(mapping, value)) {
      mapping[value] = `#/components/schemas/${subtype}`;
    }
  }
  if (discriminator.ambiguous.length > 0) {
    ledger.extended('discriminator_collisions', discriminator.ambiguous.length);
  }
  return {
    discriminator: { propertyName: discriminator.field, mapping },
    'x-telegram-discriminator-enum': discriminator.enumName,
    ...(discriminator.ambiguous.length === 0
      ? {}
      : { 'x-telegram-discriminator-ambiguous': discriminator.ambiguous }),
  };
}

/**
 * Builds the schema of one field.
 *
 * A field an enum types refers to that enum rather than repeating its values.
 * That is what `applies_to` is for, and a reference is what makes a generator
 * emit one shared type instead of forty copies of the same list of strings.
 *
 * @param spec the specification
 * @param owner name of the type or method the field belongs to
 * @param enumSites which enum types which member
 * @param ledger records where every fact went
 */
export function schemaForField(
  spec: Spec,
  owner: string,
  field: SpecField,
  enumSites: Readonly<Record<string, string>>,
  ledger: Ledger,
): JsonSchema {
  const site = `${owner}.${field.name}`;
  const typed = enumSites[site];
  const base = typed === undefined ? schemaForColumn(field.types) : enumTypedSchema(field, typed);
  if (typed !== undefined) {
    ledger.standard('enum_sites', 1);
  }
  ledger.standard('fields', 1);

  const applied = applyFacts(spec.fields[site]);
  ledger.standard('field_facts', applied.standard.length);
  ledger.extended('field_facts', applied.extended.length);

  return {
    ...base,
    description: field.description,
    ...applied.keywords,
    ...applied.extensions,
  };
}

/**
 * A field typed by an enum, keeping the shape of its column.
 *
 * `allowed_updates` is an `Array of String` typed by `UpdateType`, so the array
 * stays an array and only its items become the reference.
 */
function enumTypedSchema(field: SpecField, enumName: string): JsonSchema {
  const reference = { $ref: `#/components/schemas/${enumName}` };
  const [only] = field.types;
  if (field.types.length === 1 && only !== undefined && only.startsWith('Array of ')) {
    return { type: 'array', items: reference };
  }
  return reference;
}
