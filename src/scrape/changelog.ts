import { toBlocks } from '../html/blocks.ts';
import type { ChangelogEntry, ChangelogGroup } from '../schema/model.ts';
import type { DocsSection } from './sections.ts';
import { parseDocsDate } from './version.ts';

const VERSION = /^Bot API (\d+(?:\.\d+)*)$/u;

/**
 * Reads the Recent changes part into entries.
 *
 * Telegram writes each release as a date, a version, and captioned lists of what
 * changed. No specification carries it, so the release notes of the Bot API
 * exist only as prose on one HTML page — and the nightly job that opens a pull
 * request has to describe a release in its own words instead of Telegram's.
 *
 * @param sections the `<h4>` sections of the Recent changes part, in page order
 * @returns entries newest first
 * @throws when an entry does not open with a version line
 */
export function parseChangelog(sections: readonly DocsSection[]): readonly ChangelogEntry[] {
  return sections.map((section) => {
    const blocks = toBlocks(section.nodes);
    const version = VERSION.exec(blocks.at(0)?.text ?? '')?.[1];
    if (version === undefined) {
      throw new Error(
        `The changelog entry "${section.title}" does not open with a Bot API version — the documentation markup has changed`,
      );
    }
    return {
      version,
      date: parseDocsDate(section.title),
      anchor: section.anchor,
      groups: groupChanges(blocks.slice(1)),
    };
  });
}

/**
 * Pairs each caption with the list that follows it.
 *
 * A list with no caption above it keeps an empty title rather than being merged
 * into the one before: the caption is Telegram's own grouping, and inventing a
 * new one would be this stage deciding something the page did not.
 */
function groupChanges(
  blocks: readonly { tag: string; text: string; items?: readonly string[] }[],
): readonly ChangelogGroup[] {
  const groups: ChangelogGroup[] = [];
  let title = '';

  for (const block of blocks) {
    if (block.tag === 'p') {
      title = block.text;
      continue;
    }
    if (block.items !== undefined && block.items.length > 0) {
      groups.push({ title, changes: block.items });
      title = '';
    }
  }
  return groups;
}
