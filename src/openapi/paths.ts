import type { SpecMethod } from '../build/entities.ts';
import type { Spec } from '../build/spec.ts';
import type { Ledger } from './ledger.ts';
import { schemaForField } from './schemas.ts';
import { enumsBySite, type JsonSchema, schemaForColumn } from './types.ts';

/** Schema name of the envelope every answer arrives in. */
export const ENVELOPE = 'ApiResponse';

/** Schema name of the answer to a call that failed. */
export const ERROR = 'ApiError';

const INPUT_FILE = 'InputFile';
const MULTIPART = 'multipart/form-data';
const JSON_TYPE = 'application/json';

/**
 * Builds `paths` from the methods of the specification.
 *
 * The Bot API is not REST and the document does not pretend it is. Every method
 * is one path of its own name and one `post`, because that is what the
 * documentation describes: a name, a flat set of parameters, and an answer in a
 * fixed envelope.
 *
 * @param spec the specification
 * @param ledger records where every fact went
 * @returns the paths, keyed by `/methodName`
 */
export function buildPaths(spec: Spec, ledger: Ledger): Readonly<Record<string, JsonSchema>> {
  const paths: Record<string, JsonSchema> = {};
  const enumSites = enumsBySite(spec);

  for (const method of Object.values(spec.methods)) {
    paths[`/${method.name}`] = { post: operation(spec, method, enumSites, ledger) };
    ledger.standard('methods', 1);
  }
  return paths;
}

function operation(
  spec: Spec,
  method: SpecMethod,
  enumSites: Readonly<Record<string, string>>,
  ledger: Ledger,
): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  let carriesFile = false;

  for (const field of method.fields ?? []) {
    properties[field.name] = schemaForField(spec, method.name, field, enumSites, ledger);
    if (field.required) {
      required.push(field.name);
    }
    if (field.types.includes(INPUT_FILE)) {
      carriesFile = true;
    }
  }

  const parameters: JsonSchema = {
    type: 'object',
    ...(Object.keys(properties).length === 0 ? {} : { properties }),
    ...(required.length === 0 ? {} : { required }),
  };

  const result = schemaForColumn(method.returns);
  ledger.standard('returns', method.returns.length);

  if (method.notes !== undefined) {
    ledger.extended('notes', method.notes.length);
  }

  return {
    operationId: method.name,
    summary: method.description.at(0) ?? method.name,
    description: method.description.join('\n\n'),
    externalDocs: { url: method.href },
    ...(method.notes === undefined ? {} : { 'x-telegram-notes': method.notes }),
    ...(carriesFile ? { 'x-telegram-attach-mechanism': ATTACH_MECHANISM } : {}),
    ...(Object.keys(properties).length === 0
      ? {}
      : {
          requestBody: {
            required: required.length > 0,
            content: bodyContent(parameters, carriesFile),
          },
        }),
    responses: {
      // `ok` is pinned by an extension rather than by `const`. A boolean `const`
      // is correct JSON Schema and two generators turn it into an int-backed
      // enum that does not compile; the response code already says which case
      // this is, so nothing is lost by saying it the other way.
      '200': {
        description: 'The call succeeded. The result is wrapped in the standard envelope.',
        content: {
          [JSON_TYPE]: {
            schema: {
              allOf: [
                { $ref: `#/components/schemas/${ENVELOPE}` },
                {
                  type: 'object',
                  required: ['ok', 'result'],
                  properties: { ok: { type: 'boolean', 'x-telegram-always': true }, result },
                },
              ],
            },
          },
        },
      },
      default: {
        description: 'The call failed. Read description and error_code.',
        content: { [JSON_TYPE]: { schema: { $ref: `#/components/schemas/${ERROR}` } } },
      },
    },
  };
}

/**
 * The content types a call may be sent as.
 *
 * The documentation lists four ways of passing parameters and says plainly that
 * one of them cannot carry a file. A method that takes an `InputFile` therefore
 * offers only the three that can, which is a constraint no generator could work
 * out for itself.
 */
function bodyContent(parameters: JsonSchema, carriesFile: boolean): JsonSchema {
  const forms: JsonSchema = {
    [MULTIPART]: { schema: parameters },
    'application/x-www-form-urlencoded': { schema: parameters },
  };
  return carriesFile ? forms : { [JSON_TYPE]: { schema: parameters }, ...forms };
}

/**
 * How a file already in the request is named from inside a JSON parameter.
 *
 * OpenAPI has no way to say this. `sendMediaGroup` takes its media as a JSON
 * array whose entries point at parts of the same multipart body by name, and a
 * generator that does not know it produces a client that cannot send an album.
 */
const ATTACH_MECHANISM = {
  scheme: 'attach://<name>',
  description:
    'A file being uploaded in this request can be referenced from a JSON-serialized parameter by writing attach://<name>, where <name> is the name of the multipart part carrying it.',
};

/**
 * Builds the schemas every operation shares.
 *
 * The envelope is described in prose on the documentation page and never as a
 * type, so it exists here as one schema rather than as a shape repeated 185
 * times.
 *
 * @param spec the specification
 * @param ledger records where every fact went
 */
export function buildResponseSchemas(
  spec: Spec,
  ledger: Ledger,
): Readonly<Record<string, JsonSchema>> {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const field of spec.document.transport.response_envelope) {
    properties[field.name] =
      field.type === 'Any'
        ? { description: 'The result of the call.' }
        : schemaForColumn([field.type]);
    if (field.always) {
      required.push(field.name);
    }
    ledger.standard('envelope_fields', 1);
  }

  return {
    [ENVELOPE]: {
      type: 'object',
      description: 'The envelope every answer arrives in.',
      properties,
      required,
    },
    [ERROR]: {
      allOf: [
        { $ref: `#/components/schemas/${ENVELOPE}` },
        {
          type: 'object',
          required: ['ok'],
          properties: { ok: { type: 'boolean', 'x-telegram-always': false } },
        },
      ],
      description: 'The answer to a call that failed.',
    },
  };
}
