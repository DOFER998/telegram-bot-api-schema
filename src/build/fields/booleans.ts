import type { ApiField } from '../../schema/model.ts';
import type { BooleanFacts } from './model.ts';

const OPTIONAL_PREFIX = /^Optional\.\s*/u;
const PASS_TRUE = /^Pass True\b/u;

/** The description says something about `False` in its own right. */
const FALSE_MENTIONED = /\bFalse\b/u;

/**
 * Reads how the documentation writes a boolean field.
 *
 * Three raw signals, no verdict: the Bot API has three kinds of boolean and
 * turning them into types is a consumer's decision, not this one's.
 *
 * @param field the field or parameter
 * @returns the signals, or `undefined` when the field is not boolean
 */
export function parseBoolean(field: ApiField): BooleanFacts | undefined {
  if (field.types.length !== 1) {
    return undefined;
  }
  const column = field.types[0];
  if (column !== 'True' && column !== 'Boolean') {
    return undefined;
  }

  const description = field.description.replace(OPTIONAL_PREFIX, '');
  const passTrue = PASS_TRUE.test(description);

  return {
    type_column: column,
    pass_true_prefix: passTrue,
    false_documented: FALSE_MENTIONED.test(description),
  };
}
