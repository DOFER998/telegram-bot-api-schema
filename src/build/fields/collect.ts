import { fieldSemantics } from '../../declarations/effective.ts';
import type { Declarations } from '../../declarations/load.ts';
import { compareStrings } from '../../ordering.ts';
import type { ApiField, BotApiScrape } from '../../schema/model.ts';
import { parseItemBounds } from './arrays.ts';
import { parseBoolean } from './booleans.ts';
import { parseBounds } from './constraints.ts';
import { parseAllowedUpdatesDefault } from './defaults.ts';
import type { FieldFacts } from './model.ts';
import {
  parseConstant,
  parseImpliesSet,
  parseIntegerBits,
  parseOneOf,
  parseReturnedOnlyIn,
} from './prose.ts';

interface Member {
  readonly entity: string;
  readonly on: 'type' | 'method';
  readonly field: ApiField;
}

/**
 * Runs every field extractor over the whole documentation.
 *
 * A field with nothing to say drops out: the section holds only what the prose
 * actually stated, so its size is a measure of how much was extracted and a
 * collapse in that size is visible rather than silent.
 *
 * @param scrape the parsed scrape
 * @param declarations the loaded declarations
 * @returns facts keyed by `Entity.field`, ordered by key
 */
export function collectFieldFacts(
  scrape: BotApiScrape,
  declarations: Declarations,
): Readonly<Record<string, FieldFacts>> {
  const semantics = fieldSemantics(declarations);
  const collected: Record<string, FieldFacts> = {};

  for (const { entity, on, field } of members(scrape)) {
    const key = `${entity}.${field.name}`;
    const facts = factsOf(entity, on, field, scrape, semantics[key]);
    if (Object.keys(facts).length > 3) {
      collected[key] = facts;
    }
  }

  return Object.fromEntries(
    Object.entries(collected).toSorted(([left], [right]) => compareStrings(left, right)),
  );
}

function factsOf(
  entity: string,
  on: 'type' | 'method',
  field: ApiField,
  scrape: BotApiScrape,
  semantic: string | undefined,
): FieldFacts {
  const bounds = parseBounds(field);
  const items = parseItemBounds(field);
  const allowedUpdates = parseAllowedUpdatesDefault(field, scrape);

  const oneOf = parseOneOf(field);
  const constant = parseConstant(field);
  const returnedOnlyIn = parseReturnedOnlyIn(field);
  const impliesSet = parseImpliesSet(field);
  const integerBits = parseIntegerBits(field);
  const booleans = parseBoolean(field);

  return {
    entity,
    field: field.name,
    on,
    ...bounds,
    ...items,
    ...(allowedUpdates === undefined ? {} : { default: allowedUpdates }),
    ...(oneOf === undefined ? {} : { one_of: oneOf }),
    ...(constant === undefined ? {} : { constant }),
    ...(booleans === undefined ? {} : { boolean: booleans }),
    ...(returnedOnlyIn === undefined ? {} : { returned_only_in: returnedOnlyIn }),
    ...(impliesSet === undefined ? {} : { implies_set: impliesSet }),
    ...(integerBits === undefined ? {} : { integer_bits: integerBits }),
    ...(semantic === undefined ? {} : { semantic }),
  };
}

function members(scrape: BotApiScrape): readonly Member[] {
  return [
    ...Object.values(scrape.types).flatMap((type) =>
      (type.fields ?? []).map((field): Member => ({ entity: type.name, on: 'type', field })),
    ),
    ...Object.values(scrape.methods).flatMap((method) =>
      (method.parameters ?? []).map(
        (field): Member => ({ entity: method.name, on: 'method', field }),
      ),
    ),
  ];
}
