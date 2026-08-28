import type { FieldFacts } from './fields/model.ts';
import type { Spec } from './spec.ts';

/**
 * Counts what a build extracted, one number per category.
 *
 * These are the numbers the committed floor is compared against, so each has to
 * name something a single pattern produces. A category that lumps two
 * extractors together hides the failure of either one behind the other's count.
 *
 * @param spec the assembled specification
 * @returns the count of every category
 */
export function census(spec: Spec): Readonly<Record<string, number>> {
  const facts = Object.values(spec.fields);
  const document = spec.document;

  return {
    types: Object.keys(spec.types).length,
    methods: Object.keys(spec.methods).length,
    enums: Object.keys(spec.enums).length,

    'types.with_fields': count(Object.values(spec.types), (type) => type.fields !== undefined),
    'types.abstract': count(Object.values(spec.types), (type) => type.subtypes !== undefined),
    'types.subtype_of': count(Object.values(spec.types), (type) => type.subtype_of !== undefined),
    'methods.with_returns': count(
      Object.values(spec.methods),
      (method) => method.returns.length > 0,
    ),

    'notes.entities': [...Object.values(spec.types), ...Object.values(spec.methods)].reduce(
      (total, entity) => total + (entity.notes?.length ?? 0),
      0,
    ),

    'fields.total': facts.length,
    'fields.min': has(facts, 'min'),
    'fields.max': has(facts, 'max'),
    'fields.min_length': has(facts, 'min_length'),
    'fields.max_length': has(facts, 'max_length'),
    'fields.min_items': has(facts, 'min_items'),
    'fields.max_items': has(facts, 'max_items'),
    'fields.default': has(facts, 'default'),
    'fields.default_type': has(facts, 'default_type'),
    'fields.alphabet': has(facts, 'alphabet'),
    'fields.one_of': has(facts, 'one_of'),
    'fields.constant': has(facts, 'constant'),
    'fields.boolean': has(facts, 'boolean'),
    'fields.boolean.incoming_true': count(facts, (fact) => fact.boolean?.type_column === 'True'),
    'fields.boolean.pass_true': count(
      facts,
      (fact) => fact.boolean?.type_column === 'Boolean' && fact.boolean.pass_true_prefix,
    ),
    'fields.boolean.plain': count(
      facts,
      (fact) => fact.boolean?.type_column === 'Boolean' && !fact.boolean.pass_true_prefix,
    ),
    'fields.boolean.false_documented': count(
      facts,
      (fact) => fact.boolean?.false_documented === true,
    ),
    'fields.returned_only_in': has(facts, 'returned_only_in'),
    'fields.implies_set': has(facts, 'implies_set'),
    'fields.integer_bits': has(facts, 'integer_bits'),
    'fields.semantic': has(facts, 'semantic'),

    'document.articles': Object.keys(document.articles).length,
    'document.parts': Object.keys(document.parts).length,
    'document.parse_modes': Object.keys(document.formatting.modes).length,
    'document.nesting_rules': document.formatting.entity_nesting.rules.length,
    'document.mention_link_rules': document.formatting.mention_link.rules.length,
    'document.modes_with_custom_emoji': Object.values(document.formatting.modes).filter(
      (mode) => mode.custom_emoji !== undefined,
    ).length,
    'document.date_time_controls': document.formatting.date_time.controls.length,
    'document.markdownv2_escapes':
      document.formatting.modes.MarkdownV2?.escaping?.always.length ?? 0,
    'document.markdownv2_contexts':
      document.formatting.modes.MarkdownV2?.escaping?.contexts?.length ?? 0,
    'document.html_tags': document.formatting.modes.HTML?.tag_names?.length ?? 0,
    'document.html_named_entities': document.formatting.modes.HTML?.named_entities?.length ?? 0,
    'document.markdown_unsupported':
      document.formatting.modes.Markdown?.unsupported_entities?.length ?? 0,
    'document.file_transports': document.sending_files.transports.length,
    'document.file_rules': document.sending_files.transports.reduce(
      (total, transport) => total + (transport.rules?.length ?? 0),
      0,
    ),
    'document.rich_limits': document.formatting.rich.limits.length,
    'document.rich_modes': Object.keys(document.formatting.rich.modes).length,
    'document.rich_auto_detected': document.formatting.rich.auto_detected_entities.length,
    'document.rich_upload_links': document.formatting.rich.upload_links.length,
    'document.rich_markdown_tags': document.formatting.rich.modes.markdown?.tag_names.length ?? 0,
    'document.rich_html_tags': document.formatting.rich.modes.html?.tag_names.length ?? 0,
    'document.rich_html_named_entities':
      document.formatting.rich.modes.html?.named_entities?.length ?? 0,
    'document.rich_button_types':
      document.formatting.rich.modes.html?.vocabulary['tg-button']?.demonstrated_values?.type
        ?.length ?? 0,
    'document.rich_button_styles':
      document.formatting.rich.modes.html?.vocabulary['tg-button']?.demonstrated_values?.style
        ?.length ?? 0,
    'document.rich_notes': Object.values(document.formatting.rich.modes).reduce(
      (total, mode) => total + mode.notes.length,
      0,
    ),
    'document.accent_colors': document.colors.accent.length,
    'document.profile_accent_colors': document.colors.profile_accent.length,
    'document.content_types': document.transport.content_types.length,
    'document.envelope_fields': document.transport.response_envelope.length,
    'document.command_scope_steps': document.command_scopes.reduce(
      (total, chain) => total + chain.steps.length,
      0,
    ),
    'document.local_server_capabilities': document.rates.local_bot_api_server.length,
    'document.local_server_limits': document.rates.local_bot_api_server.filter(
      (capability) => capability.limit !== undefined,
    ).length,
    'document.ephemeral_targets': document.ephemeral_messages.targets.length,
    'document.token_parts': document.conventions.token.parts.length,
    'document.webhook_reply_content_types': document.transport.webhook_reply.content_types.length,
    'document.update_delivery_methods': document.conventions.update_delivery.methods.length,
    'document.repeated_statements': document.conventions.repeated_statements.length,

    'changelog.entries': spec.changelog.length,
    'changelog.changes': spec.changelog.reduce(
      (total, entry) => total + entry.groups.reduce((sum, group) => sum + group.changes.length, 0),
      0,
    ),
  };
}

function has(facts: readonly FieldFacts[], key: keyof FieldFacts): number {
  return count(facts, (fact) => fact[key] !== undefined);
}

function count<T>(values: readonly T[], predicate: (value: T) => boolean): number {
  return values.filter(predicate).length;
}
