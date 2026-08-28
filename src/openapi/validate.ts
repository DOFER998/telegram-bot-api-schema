import { Validator } from '@seriousme/openapi-schema-validator';
import { compareStrings } from '../ordering.ts';
import type { JsonSchema } from './types.ts';

/** Something the document gets wrong. */
export interface DocumentFault {
  /** Where it is, as a path into the document. */
  readonly at: string;
  /** What is wrong. */
  readonly message: string;
}

/** What the checks looked at, so a check that stopped looking is visible. */
export interface DocumentReport {
  /** Faults found, ordered by position. */
  readonly faults: readonly DocumentFault[];
  /** Schemas whose references were followed. */
  readonly schemas: number;
  /** References followed. */
  readonly references: number;
  /** Extension keys found. */
  readonly extensions: number;
}

const SCHEMA_PREFIX = '#/components/schemas/';
const EXTENSION_PREFIX = 'x-';
const LISTED_FAULTS = 20;

/**
 * Checks the OpenAPI document against the meta-schema, then follows every `$ref`.
 *
 * The meta-schema does not look inside Schema Objects, so a `$ref` naming a
 * schema that does not exist passes it and breaks every generator afterwards.
 *
 * A purpose-built validator rather than bare ajv: the 3.1 meta-schema reaches
 * the Schema Object through `$dynamicRef`, and ajv resolves that wrongly —
 * measured on a trivially correct document, which it rejected.
 *
 * @param document the OpenAPI document
 * @returns what was checked and what was wrong
 */
export async function validateDocument(document: JsonSchema): Promise<DocumentReport> {
  const faults: DocumentFault[] = [];

  const result = await new Validator().validate(document);
  if (!result.valid) {
    for (const error of asErrors(result.errors)) {
      faults.push({ at: error.instancePath || '/', message: error.message ?? 'invalid' });
    }
  }

  const components =
    (document.components as { schemas?: Record<string, unknown> } | undefined)?.schemas ?? {};
  const known = new Set(Object.keys(components));

  let references = 0;
  let extensions = 0;

  walk(document, '', (path, node) => {
    const reference = node.$ref;
    if (typeof reference === 'string') {
      references += 1;
      if (
        reference.startsWith(SCHEMA_PREFIX) &&
        !known.has(reference.slice(SCHEMA_PREFIX.length))
      ) {
        faults.push({ at: path, message: `$ref points at ${reference}, which is not defined` });
      }
    }
    for (const key of Object.keys(node)) {
      if (key.startsWith(EXTENSION_PREFIX)) {
        extensions += 1;
      }
    }
  });

  return {
    faults: faults.toSorted((left, right) => compareStrings(left.at, right.at)),
    schemas: known.size,
    references,
    extensions,
  };
}

/** Renders the first few faults for the console. */
export function describeFaults(report: DocumentReport): readonly string[] {
  const shown = report.faults
    .slice(0, LISTED_FAULTS)
    .map((fault) => `  ! ${fault.at} ${fault.message}`);
  return report.faults.length > LISTED_FAULTS
    ? [...shown, `  and ${report.faults.length - LISTED_FAULTS} more`]
    : shown;
}

interface ValidationError {
  readonly instancePath?: string;
  readonly message?: string;
}

/** The validator reports either a list of errors or a single message. */
function asErrors(errors: unknown): readonly ValidationError[] {
  if (Array.isArray(errors)) {
    return errors as readonly ValidationError[];
  }
  return errors === undefined ? [] : [{ message: String(errors) }];
}

function walk(node: unknown, path: string, visit: (path: string, node: JsonSchema) => void): void {
  if (Array.isArray(node)) {
    node.forEach((item, index) => {
      walk(item, `${path}/${index}`, visit);
    });
    return;
  }
  if (node === null || typeof node !== 'object') {
    return;
  }
  const record = node as JsonSchema;
  visit(path === '' ? '/' : path, record);
  for (const [key, value] of Object.entries(record)) {
    walk(value, `${path}/${key}`, visit);
  }
}
