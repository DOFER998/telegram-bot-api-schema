import type { ApiField, BotApiScrape } from '../../schema/model.ts';

/**
 * The same default is written two ways. `WebhookInfo` states it directly;
 * `getUpdates` and `setWebhook` phrase it as what an empty list gets you and
 * mark the sentence `(default)` at the end. Both are the same set, and a
 * consumer that only handled one phrasing would carry the default on the type
 * and miss it on the two methods that actually take the parameter.
 *
 * The exclusions are marked up with emphasis, which is what keeps them apart
 * from the prose around them.
 */
const ALL_EXCEPT =
  /(?:Defaults to|Specify an empty list to receive) all update types except ((?:<em>[a-z_]+<\/em>[,\s]*(?:and\s+)?)+)/u;
const EMPHASISED = /<em>([a-z_]+)<\/em>/gu;

const UPDATE_TYPE_SOURCE = 'Update';
const UPDATE_ID = 'update_id';

/**
 * Works out the default set of update types.
 *
 * The documentation states it by subtraction and never lists it. Computed from
 * the fields of `Update`, which is where `UpdateType` comes from too, so the
 * two cannot disagree.
 *
 * @param field the field or parameter
 * @param scrape the parsed scrape
 * @returns the update types received by default, or `undefined` when there is no such default
 * @throws when the exclusions name an update type `Update` does not have
 */
export function parseAllowedUpdatesDefault(
  field: ApiField,
  scrape: BotApiScrape,
): readonly string[] | undefined {
  const match = ALL_EXCEPT.exec(field.html_description);
  if (match === null) {
    return undefined;
  }

  const excluded = [...(match[1] ?? '').matchAll(EMPHASISED)].map((found) => found[1] ?? '');
  const all = (scrape.types[UPDATE_TYPE_SOURCE]?.fields ?? [])
    .map((member) => member.name)
    .filter((name) => name !== UPDATE_ID);

  const unknown = excluded.filter((name) => !all.includes(name));
  if (unknown.length > 0) {
    throw new Error(
      `The default set of allowed_updates excludes ${unknown.join(', ')}, which ${UPDATE_TYPE_SOURCE} does not have`,
    );
  }
  return all.filter((name) => !excluded.includes(name));
}
