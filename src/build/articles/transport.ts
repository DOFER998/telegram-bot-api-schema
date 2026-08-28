import type { BotApiScrape, DocsGroup } from '../../schema/model.ts';

/** How a request reaches the Bot API. */
export interface Transport {
  /** The address template, with `<token>` and `METHOD_NAME` left in place. */
  readonly url_template: string;
  /** Content types a request may use to carry its parameters. */
  readonly content_types: readonly string[];
  /** Fields the envelope around every answer carries. */
  readonly response_envelope: readonly EnvelopeField[];
  /** Rules that hold for every call. */
  readonly rules: readonly string[];
  /** Whether the transport is HTTPS only. It is. */
  readonly requires_https: boolean;
  /** Answering a webhook with a call instead of an empty body. */
  readonly webhook_reply: WebhookReply;
}

/**
 * A bot may answer the webhook request itself with a Bot API call.
 *
 * It saves a round trip on the commonest thing a bot does, and it is stated in
 * a section of its own that no specification carries. The catch is stated in the
 * same paragraph: the answer is not reported back, so a call made this way
 * cannot be checked.
 */
export interface WebhookReply {
  /** The parameter naming the method to invoke. */
  readonly method_field: string;
  /** Content types the answer may use. A query string is not among them. */
  readonly content_types: readonly string[];
  /** Whether the result of such a call can be observed. It cannot. */
  readonly result_available: boolean;
  /** The sentence it was read from. */
  readonly text: string;
}

/** One field of the envelope every answer arrives in. */
export interface EnvelopeField {
  /** Name of the field. */
  readonly name: string;
  /** Type in the vocabulary of the documentation. */
  readonly type: string;
  /** Whether the field is present on every answer. */
  readonly always: boolean;
}

const MAKING_REQUESTS = 'making-requests';

const URL_TEMPLATE = /(https:\/\/api\.telegram\.org\/bot<token>\/METHOD_NAME)/u;

/** `All queries to the Telegram Bot API must be served over HTTPS` */
const HTTPS = /must be served over HTTPS/u;

const WEBHOOK_REPLY = 'making-requests-when-getting-updates';

/** `Specify the method to be invoked in the method parameter of the request.` */
const METHOD_FIELD = /Specify the method to be invoked in the ([a-z_]+) parameter/u;

/** `Use either application/json or application/x-www-form-urlencoded or multipart/form-data` */
const REPLY_CONTENT_TYPES = /Use either ((?:[a-z/+-]+(?: or )?)+) response content type/u;

/** `It's not possible to know that such a request was successful or get its result.` */
const NO_RESULT = /not possible to know that such a request was successful/u;

/**
 * The envelope is described in prose and never as a type, so a client either
 * models it from this paragraph or hard-codes the four field names. The shape
 * does not change, and stating it once is the point of writing it down.
 */
const ENVELOPE: readonly EnvelopeField[] = [
  { name: 'ok', type: 'Boolean', always: true },
  { name: 'result', type: 'Any', always: false },
  { name: 'description', type: 'String', always: false },
  { name: 'error_code', type: 'Integer', always: false },
  { name: 'parameters', type: 'ResponseParameters', always: false },
];

/**
 * Reads how a request is addressed and what comes back.
 *
 * @param scrape the parsed scrape
 * @returns the transport contract
 * @throws when the part is missing or no longer states the address template
 */
export function buildTransport(scrape: BotApiScrape): Transport {
  const group = scrape.groups[MAKING_REQUESTS];
  if (group === undefined) {
    throw new Error(`The page has no #${MAKING_REQUESTS} part — the documentation has changed`);
  }

  const template = group.blocks
    .map((block) => URL_TEMPLATE.exec(block.text))
    .find((match) => match !== null);
  if (template === null || template === undefined) {
    throw new Error(`#${MAKING_REQUESTS} no longer states the request URL template`);
  }

  const lists = group.blocks.filter((block) => block.items !== undefined);
  const contentTypes = lists.at(0)?.items ?? [];
  const rules = lists.at(-1)?.items ?? [];

  if (contentTypes.length === 0) {
    throw new Error(`#${MAKING_REQUESTS} no longer lists the ways of passing parameters`);
  }

  const prose = group.blocks.map((block) => block.text).join(' ');
  if (!HTTPS.test(prose)) {
    throw new Error(`#${MAKING_REQUESTS} no longer states that the transport is HTTPS only`);
  }

  return {
    url_template: template[1] ?? '',
    content_types: contentTypes,
    response_envelope: ENVELOPE,
    rules: verifyEnvelope(group, rules),
    requires_https: true,
    webhook_reply: parseWebhookReply(scrape),
  };
}

/**
 * Reads how a bot answers the webhook with a call of its own.
 *
 * @param scrape the parsed scrape
 * @throws when the section is missing or no longer names the parameter
 */
function parseWebhookReply(scrape: BotApiScrape): WebhookReply {
  const article = scrape.articles[WEBHOOK_REPLY];
  if (article === undefined) {
    throw new Error(`The page has no #${WEBHOOK_REPLY} section — the documentation has changed`);
  }
  const text = article.blocks.map((block) => block.text).join(' ');

  const field = METHOD_FIELD.exec(text)?.[1];
  const types = REPLY_CONTENT_TYPES.exec(text)?.[1];
  if (field === undefined || types === undefined) {
    throw new Error(`#${WEBHOOK_REPLY} no longer names the method parameter or the content types`);
  }

  return {
    method_field: field,
    content_types: types.split(' or ').map((type) => type.trim()),
    result_available: !NO_RESULT.test(text),
    text: article.blocks.at(0)?.text ?? '',
  };
}

/**
 * Checks that the paragraph describing the envelope still names every field.
 *
 * The envelope is the one thing here written out by hand rather than parsed, so
 * it is checked against the page instead of trusted: a field renamed upstream
 * has to bring the build down rather than sit in the specification as a
 * plausible lie.
 */
function verifyEnvelope(group: DocsGroup, rules: readonly string[]): readonly string[] {
  const prose = group.blocks.map((block) => block.text).join(' ');
  const missing = ENVELOPE.filter(
    (field) => !prose.includes(`'${field.name}'`) && !prose.includes(field.name),
  );
  if (missing.length > 0) {
    throw new Error(
      `#${MAKING_REQUESTS} no longer mentions the response fields ${missing.map((field) => field.name).join(', ')}`,
    );
  }
  return rules;
}
