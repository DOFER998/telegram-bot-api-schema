import { toBlocks } from '../html/blocks.ts';
import { elementById, parseDocument } from '../html/dom.ts';
import { compareStrings } from '../ordering.ts';
import type { BotApiScrape, DocsArticle, DocsGroup } from '../schema/model.ts';
import { parseChangelog } from './changelog.ts';
import { isEntitySection, isTypeSection, parseMethod, parseType } from './entities.ts';
import { type DocsSection, type GroupSection, splitPage, splitSubsections } from './sections.ts';
import { parseRelease, RECENT_CHANGES } from './version.ts';

const CONTENT_ID = 'dev_page_content';

/**
 * Parses the Bot API documentation page into a scrape.
 *
 * A pure function of the HTML. Everything on the page is captured as structure
 * and nothing is interpreted: turning a paragraph into a rule is the build's
 * job, where it can be held to an expected count.
 *
 * @param html source HTML of the page
 * @returns the parsed scrape
 * @throws when the markup has changed enough that parsing stops adding up
 */
export function parseDocsPage(html: string): BotApiScrape {
  const content = elementById(parseDocument(html), CONTENT_ID);
  if (content === undefined) {
    throw new Error(
      `The page has no #${CONTENT_ID} container — the documentation markup has changed`,
    );
  }

  const { sections, groups } = splitPage(content);
  const entities = sections.filter(isEntitySection);
  const typeSections = entities.filter(isTypeSection);
  const methodSections = entities.filter((section) => !isTypeSection(section));
  const knownTypes = new Set(typeSections.map((section) => section.title));

  return {
    ...parseRelease(content),
    types: byName(typeSections.map((section) => parseType(section, knownTypes))),
    methods: byName(methodSections.map((section) => parseMethod(section, knownTypes))),
    articles: byAnchor(
      sections
        .filter((section) => section.group !== RECENT_CHANGES && !isEntitySection(section))
        .map(toArticle),
    ),
    groups: byAnchor(groups.map(toGroup).filter((group) => group.blocks.length > 0)),
    changelog: parseChangelog(sections.filter((section) => section.group === RECENT_CHANGES)),
  };
}

function toArticle(section: DocsSection): DocsArticle {
  const { lead, subsections } = splitSubsections(section.nodes);
  const parsed = subsections.map((subsection) => ({
    anchor: subsection.anchor,
    title: subsection.title,
    blocks: toBlocks(subsection.nodes),
  }));

  return {
    anchor: section.anchor,
    group: section.group,
    title: section.title,
    blocks: toBlocks(lead),
    ...(parsed.length === 0 ? {} : { subsections: parsed }),
  };
}

function toGroup(group: GroupSection): DocsGroup {
  return { anchor: group.anchor, title: group.title, blocks: toBlocks(group.nodes) };
}

function byName<T extends { readonly name: string }>(entities: readonly T[]): Record<string, T> {
  return indexed(entities, (entity) => entity.name, 'name');
}

function byAnchor<T extends { readonly anchor: string }>(
  entities: readonly T[],
): Record<string, T> {
  return indexed(entities, (entity) => entity.anchor, 'anchor');
}

function indexed<T>(
  entities: readonly T[],
  key: (entity: T) => string,
  label: string,
): Record<string, T> {
  const result: Record<string, T> = {};
  for (const entity of entities.toSorted((left, right) => compareStrings(key(left), key(right)))) {
    if (Object.hasOwn(result, key(entity))) {
      throw new Error(`The ${label} "${key(entity)}" occurs twice in the documentation`);
    }
    result[key(entity)] = entity;
  }
  return result;
}
