import type { BotApiScrape, DocsArticle } from '../../schema/model.ts';

/** One accent colour identifier and the palettes it renders as. */
export interface AccentColor {
  /** The identifier a `Chat` reports in `accent_color_id`. */
  readonly id: number;
  /** Colours used under a light theme, as `RRGGBB`. Absent for a customizable identifier. */
  readonly light?: readonly string[];
  /** Colours used under a dark theme, as `RRGGBB`. Absent for a customizable identifier. */
  readonly dark?: readonly string[];
  /** The name the documentation gives the colour, for a customizable identifier. */
  readonly name?: string;
  /** Whether the app theme decides the actual colour. */
  readonly customizable?: boolean;
}

/** Both colour tables of the documentation. */
export interface AccentColors {
  /** Message accent colours. */
  readonly accent: readonly AccentColor[];
  /** Profile background accent colours. */
  readonly profile_accent: readonly AccentColor[];
}

const TABLES: readonly { readonly key: keyof AccentColors; readonly anchor: string }[] = [
  { key: 'accent', anchor: 'accent-colors' },
  { key: 'profile_accent', anchor: 'profile-accent-colors' },
];

const HEADER = ['Color identifier', 'Light colors', 'Dark colors'];
const RGB = /^[0-9A-F]{6}$/u;

/**
 * `Colors with identifiers 0 (red), 1 (orange), … can be customized by app
 * themes.`
 *
 * The first seven identifiers carry no fixed palette and so do not appear in the
 * table. Reading only the table yields fourteen colours and silently loses the
 * seven a chat is most likely to actually use.
 */
const CUSTOMIZABLE = /identifiers ((?:\d+ \([^)]+\)[,\s]*(?:and\s+)?)+) can be customized/u;
const CUSTOMIZABLE_ITEM = /(\d+) \(([^)]+)\)/gu;

/**
 * Reads the two colour tables.
 *
 * `Chat.accent_color_id` is an `Integer` in every specification and the palette
 * it indexes exists only as an HTML table, so a client that wants to render a
 * chat the way Telegram does has to transcribe forty rows by hand.
 *
 * @param scrape the parsed scrape
 * @returns both tables
 * @throws when a table is missing or a cell does not hold colours
 */
export function buildColors(scrape: BotApiScrape): AccentColors {
  const built = TABLES.map(({ key, anchor }) => {
    const article = scrape.articles[anchor];
    if (article === undefined) {
      throw new Error(`The page has no #${anchor} section — the documentation has changed`);
    }
    return [key, [...parseCustomizable(article), ...parseTable(article)]] as const;
  });
  return Object.fromEntries(built) as unknown as AccentColors;
}

/**
 * Reads the identifiers whose colour the app theme decides.
 *
 * @param article the colour article
 * @returns the customizable identifiers, empty when the article names none
 */
function parseCustomizable(article: DocsArticle): readonly AccentColor[] {
  const match = article.blocks
    .map((block) => CUSTOMIZABLE.exec(block.text))
    .find((found) => found !== null);
  if (match === null || match === undefined) {
    return [];
  }
  return [...(match[1] ?? '').matchAll(CUSTOMIZABLE_ITEM)].map((found) => ({
    id: Number(found[1]),
    name: found[2] ?? '',
    customizable: true,
  }));
}

function parseTable(article: DocsArticle): readonly AccentColor[] {
  const table = article.blocks.find((block) => block.rows !== undefined)?.rows;
  if (table === undefined) {
    throw new Error(`#${article.anchor} no longer holds a table of colours`);
  }

  const [header, ...rows] = table;
  if (header === undefined || !sameStrings(header, HEADER)) {
    throw new Error(`#${article.anchor}: unfamiliar table header [${(header ?? []).join(', ')}]`);
  }

  return rows.map((row) => {
    const [id = '', light = '', dark = ''] = row;
    return {
      id: Number(id),
      light: colors(light, article.anchor),
      dark: colors(dark, article.anchor),
    };
  });
}

/**
 * A cell holds one or more colours written without a separator.
 *
 * The documentation renders each as a swatch, so the cell reads as `E15052
 * F9AE63` — six hexadecimal digits at a time, and nothing else may appear.
 */
function colors(cell: string, anchor: string): readonly string[] {
  const found = cell.split(/\s+/u).filter((value) => value.length > 0);
  const invalid = found.filter((value) => !RGB.test(value));
  if (found.length === 0 || invalid.length > 0) {
    throw new Error(`#${anchor}: "${cell}" does not read as a list of RGB colours`);
  }
  return found;
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
