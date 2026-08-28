import type { Spec } from '../build/spec.ts';
import { recoverDiscriminators } from './discriminators.ts';
import { Ledger } from './ledger.ts';
import { buildPaths, buildResponseSchemas } from './paths.ts';
import { buildSchemas } from './schemas.ts';
import type { JsonSchema } from './types.ts';

/** The document, and the account of where every fact of the specification went. */
export interface OpenApiBuild {
  /** The OpenAPI document. */
  readonly document: JsonSchema;
  /** Where every fact ended up. */
  readonly ledger: Ledger;
}

const OPENAPI_VERSION = '3.1.0';

/**
 * The base URL, with the token as a server variable.
 *
 * The token is a path segment, not a header and not a query parameter. Modelled
 * as a security scheme it would be sent in the wrong place by every generated
 * client; as a server variable each client asks for it once and then forgets it.
 */
const SERVER_VARIABLE = 'token';

/**
 * Turns the specification into an OpenAPI document.
 *
 * A transformation, not a second pipeline: it reads `spec.json` and never the
 * page. Everything JSON Schema and OpenAPI have a word for becomes that word;
 * everything else becomes an `x-` extension, and the ledger proves nothing was
 * dropped on the way.
 *
 * @param spec the specification
 * @returns the document and the account of the translation
 */
export function buildOpenApi(spec: Spec): OpenApiBuild {
  const ledger = new Ledger();
  expectEverything(spec, ledger);

  const discriminators = recoverDiscriminators(spec);
  const document: JsonSchema = {
    openapi: OPENAPI_VERSION,
    // `externalDocs` is not a field of the Info Object — it belongs at the root.
    info: {
      title: 'Telegram Bot API',
      version: spec.version,
      description: describe(spec),
    },
    externalDocs: { url: spec.source, description: 'The documentation this was generated from.' },
    servers: [
      {
        url: `https://api.telegram.org/bot{${SERVER_VARIABLE}}`,
        description: 'The Bot API server. Substitute the authentication token.',
        variables: {
          [SERVER_VARIABLE]: {
            default: '<token>',
            description: 'The authentication token @BotFather issued for the bot.',
          },
        },
      },
    ],
    paths: buildPaths(spec, ledger),
    components: {
      schemas: {
        ...buildSchemas(spec, discriminators, ledger),
        ...buildResponseSchemas(spec, ledger),
      },
    },
    ...documentExtensions(spec, ledger),
  };

  return { document, ledger };
}

/**
 * The note a consumer needs before reading anything generated from this.
 *
 * Every generated method returns the envelope rather than the result inside it.
 * That is what the API actually answers, and a document that pretended
 * otherwise would produce clients that cannot tell an error from a value.
 */
function describe(spec: Spec): string {
  return [
    `Generated from the Telegram Bot API documentation, version ${spec.version} (${spec.release_date}).`,
    '',
    'Every operation answers with the standard envelope: an object carrying `ok`, and',
    'then either `result` or `description` and `error_code`. A generated client therefore',
    'returns the envelope, not the value inside it — unwrapping is the caller’s job.',
    '',
    'Everything the documentation states outside its tables of types and methods is',
    'carried in `x-telegram-*` extensions, at the document root and on the schemas and',
    'operations it belongs to.',
  ].join('\n');
}

/**
 * Facts of the specification that no OpenAPI field can hold.
 *
 * The escaping rules, the nesting restrictions, the colour tables, the order in
 * which command scopes are searched, the file-sending ceilings, the rich modes,
 * the conventions stated once in an introduction, and the changelog. All of it
 * is what makes this specification worth having, and none of it has a standard
 * place, so it sits at the root under `x-telegram-`.
 */
function documentExtensions(spec: Spec, ledger: Ledger): JsonSchema {
  const document = spec.document;
  ledger.extended('document_facts', countDocumentFacts(spec));
  ledger.extended(
    'changelog',
    spec.changelog.reduce(
      (total, entry) => total + entry.groups.reduce((sum, group) => sum + group.changes.length, 0),
      0,
    ),
  );

  return {
    'x-telegram-formatting': document.formatting,
    'x-telegram-sending-files': document.sending_files,
    'x-telegram-colors': document.colors,
    'x-telegram-transport': document.transport,
    'x-telegram-command-scopes': document.command_scopes,
    'x-telegram-ephemeral-messages': document.ephemeral_messages,
    'x-telegram-rates': document.rates,
    'x-telegram-conventions': document.conventions,
    'x-telegram-changelog': spec.changelog,
    'x-telegram-spec': {
      source: spec.source,
      release_date: spec.release_date,
      spec_format: spec.spec_format,
      note: 'The full specification, including the prose of every section verbatim, is published beside this document as spec.json.',
    },
  };
}

/**
 * Counts the facts of the specification, so the ledger has something to check
 * the document against.
 *
 * The counts match the ones the build already reports, because a second way of
 * counting the same things would eventually disagree with the first and neither
 * would be obviously wrong.
 */
function expectEverything(spec: Spec, ledger: Ledger): void {
  ledger.expect('types', Object.keys(spec.types).length);
  ledger.expect('methods', Object.keys(spec.methods).length);
  ledger.expect('enums', Object.keys(spec.enums).length);
  ledger.expect(
    'enum_values',
    Object.values(spec.enums).reduce((total, item) => total + item.values.length, 0),
  );
  ledger.expect(
    'enum_sites',
    Object.values(spec.enums).reduce((total, item) => total + (item.applies_to ?? []).length, 0),
  );
  ledger.expect(
    'fields',
    [...Object.values(spec.types), ...Object.values(spec.methods)].reduce(
      (total, entity) => total + (entity.fields?.length ?? 0),
      0,
    ),
  );
  ledger.expect(
    'returns',
    Object.values(spec.methods).reduce((total, method) => total + method.returns.length, 0),
  );
  ledger.expect(
    'abstract_links',
    Object.values(spec.types).reduce(
      (total, type) => total + (type.subtypes?.length ?? 0) + (type.subtype_of?.length ?? 0),
      0,
    ),
  );
  ledger.expect(
    'notes',
    [...Object.values(spec.types), ...Object.values(spec.methods)].reduce(
      (total, entity) => total + (entity.notes?.length ?? 0),
      0,
    ),
  );
  ledger.expect('field_facts', countFieldFacts(spec));
  ledger.expect('envelope_fields', spec.document.transport.response_envelope.length);
  ledger.expect('document_facts', countDocumentFacts(spec));
  ledger.expect(
    'changelog',
    spec.changelog.reduce(
      (total, entry) => total + entry.groups.reduce((sum, group) => sum + group.changes.length, 0),
      0,
    ),
  );
}

const FIELD_FACT_KEYS = [
  'min',
  'max',
  'min_length',
  'max_length',
  'min_items',
  'max_items',
  'default',
  'default_type',
  'alphabet',
  'one_of',
  'constant',
  'boolean',
  'returned_only_in',
  'implies_set',
  'integer_bits',
  'semantic',
] as const;

function countFieldFacts(spec: Spec): number {
  return Object.values(spec.fields).reduce(
    (total, facts) => total + FIELD_FACT_KEYS.filter((key) => facts[key] !== undefined).length,
    0,
  );
}

/**
 * Counts what the prose outside the tables states.
 *
 * The whole of `document` is carried into extensions verbatim, so this counts
 * the sections it is made of rather than each sentence: a section either arrives
 * whole or does not arrive.
 */
function countDocumentFacts(spec: Spec): number {
  const document = spec.document;
  const carried = [
    document.formatting,
    document.sending_files,
    document.colors,
    document.transport,
    document.command_scopes,
    document.ephemeral_messages,
    document.rates,
    document.conventions,
  ];
  return carried.length;
}
