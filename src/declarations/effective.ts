import type { FieldSemantic } from '#kit';
import type { ApiMethod, BotApiScrape } from '../schema/model.ts';
import type { Declarations } from './load.ts';

/**
 * Return types of a method, with the declaration taking precedence over the scrape.
 *
 * @param method the method from the scrape
 * @param declarations the loaded declarations
 * @returns return types, or `undefined` when neither source supplies them
 */
export function methodReturns(
  method: ApiMethod,
  declarations: Declarations,
): readonly string[] | undefined {
  return declarations.methods[method.name]?.options.returns ?? method.returns;
}

/**
 * Collects every declared semantic marker, keyed by `Entity.field`.
 *
 * @param declarations the loaded declarations
 * @returns the marker of each field that carries one
 */
export function fieldSemantics(
  declarations: Declarations,
): Readonly<Record<string, FieldSemantic>> {
  const semantics: Record<string, FieldSemantic> = {};
  const sources = [...Object.values(declarations.types), ...Object.values(declarations.methods)];
  for (const declaration of sources) {
    for (const [field, marker] of Object.entries(declaration.options.semantics ?? {})) {
      semantics[`${declaration.name}.${field}`] = marker;
    }
  }
  return semantics;
}

/** Names of every type in the specification. */
export function knownTypeNames(scrape: BotApiScrape): ReadonlySet<string> {
  return new Set(Object.keys(scrape.types));
}
