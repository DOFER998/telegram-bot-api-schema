import type { Spec } from '../build/spec.ts';
import { compareStrings } from '../ordering.ts';

/** What changed between the committed specification and a freshly built one. */
export interface SpecChange {
  /** Whether the Bot API version itself moved. */
  readonly version: { readonly from: string; readonly to: string } | undefined;
  /** Types that appeared. */
  readonly addedTypes: readonly string[];
  /** Types that disappeared. */
  readonly removedTypes: readonly string[];
  /** Methods that appeared. */
  readonly addedMethods: readonly string[];
  /** Methods that disappeared. */
  readonly removedMethods: readonly string[];
  /** Fields and parameters that appeared, written `Entity.field`. */
  readonly addedFields: readonly string[];
  /** Fields and parameters that disappeared. */
  readonly removedFields: readonly string[];
  /** Fields and parameters whose type, requiredness or description changed. */
  readonly changedFields: readonly string[];
  /** Enums whose value set changed. */
  readonly changedEnums: readonly string[];
}

interface Member {
  readonly types: readonly string[];
  readonly required: boolean;
  readonly description: string;
}

/**
 * Compares the committed specification with a freshly built one.
 *
 * This is what the nightly pull request is about. A diff of a two-megabyte JSON
 * file tells a reader nothing; a list of what Telegram added, removed and
 * changed tells them whether they need to care.
 *
 * @param previous the committed specification, or `undefined` on a first run
 * @param next the freshly built specification
 */
export function compareSpecVersions(previous: Spec | undefined, next: Spec): SpecChange {
  if (previous === undefined) {
    return firstRun(next);
  }

  const before = membersOf(previous);
  const after = membersOf(next);
  const names = [...new Set([...Object.keys(before), ...Object.keys(after)])];

  return {
    version:
      previous.version === next.version ? undefined : { from: previous.version, to: next.version },
    addedTypes: missing(next.types, previous.types),
    removedTypes: missing(previous.types, next.types),
    addedMethods: missing(next.methods, previous.methods),
    removedMethods: missing(previous.methods, next.methods),
    addedFields: names.filter((name) => before[name] === undefined).toSorted(compareStrings),
    removedFields: names.filter((name) => after[name] === undefined).toSorted(compareStrings),
    changedFields: names
      .filter((name) => {
        const left = before[name];
        const right = after[name];
        return left !== undefined && right !== undefined && !sameMember(left, right);
      })
      .toSorted(compareStrings),
    changedEnums: Object.keys(next.enums)
      .filter((name) => {
        const left = previous.enums[name];
        return left !== undefined && left.values.join(' ') !== next.enums[name]?.values.join(' ');
      })
      .toSorted(compareStrings),
  };
}

/** Whether anything at all moved. */
export function isUnchanged(change: SpecChange): boolean {
  return (
    change.version === undefined &&
    change.addedTypes.length === 0 &&
    change.removedTypes.length === 0 &&
    change.addedMethods.length === 0 &&
    change.removedMethods.length === 0 &&
    change.addedFields.length === 0 &&
    change.removedFields.length === 0 &&
    change.changedFields.length === 0 &&
    change.changedEnums.length === 0
  );
}

/** Renders the change as the body of a pull request. */
export function formatReport(change: SpecChange, next: Spec): string {
  const lines: string[] = [`## Bot API ${next.version} (${next.release_date})`, ''];

  if (change.version !== undefined) {
    lines.push(`Version moved from **${change.version.from}** to **${change.version.to}**.`, '');
  }

  const sections: readonly (readonly [string, readonly string[]])[] = [
    ['Types added', change.addedTypes],
    ['Types removed', change.removedTypes],
    ['Methods added', change.addedMethods],
    ['Methods removed', change.removedMethods],
    ['Fields added', change.addedFields],
    ['Fields removed', change.removedFields],
    ['Fields changed', change.changedFields],
    ['Enums changed', change.changedEnums],
  ];

  for (const [title, names] of sections) {
    if (names.length === 0) {
      continue;
    }
    lines.push(`### ${title} (${names.length})`, '');
    lines.push(...names.map((name) => `- \`${name}\``), '');
  }

  const entry = next.changelog.at(0);
  if (entry !== undefined && entry.version === next.version) {
    lines.push('### What Telegram says', '');
    for (const group of entry.groups) {
      if (group.title.length > 0) {
        lines.push(`**${group.title}**`, '');
      }
      lines.push(...group.changes.map((text) => `- ${text}`), '');
    }
  }

  return lines.join('\n');
}

function firstRun(next: Spec): SpecChange {
  return {
    version: undefined,
    addedTypes: Object.keys(next.types).toSorted(compareStrings),
    removedTypes: [],
    addedMethods: Object.keys(next.methods).toSorted(compareStrings),
    removedMethods: [],
    addedFields: [],
    removedFields: [],
    changedFields: [],
    changedEnums: [],
  };
}

function missing(left: object, right: object): readonly string[] {
  return Object.keys(left)
    .filter((name) => !Object.hasOwn(right, name))
    .toSorted(compareStrings);
}

function membersOf(spec: Spec): Readonly<Record<string, Member>> {
  const members: Record<string, Member> = {};
  for (const type of Object.values(spec.types)) {
    for (const field of type.fields ?? []) {
      members[`${type.name}.${field.name}`] = field;
    }
  }
  for (const method of Object.values(spec.methods)) {
    for (const field of method.fields ?? []) {
      members[`${method.name}.${field.name}`] = field;
    }
  }
  return members;
}

function sameMember(left: Member, right: Member): boolean {
  return (
    left.required === right.required &&
    left.description === right.description &&
    left.types.length === right.types.length &&
    left.types.every((value, index) => value === right.types[index])
  );
}
