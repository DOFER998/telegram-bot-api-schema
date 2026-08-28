import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { EnumDeclaration, MethodDeclaration, TypeDeclaration } from '#kit';
import type { ResolvedConfig } from '../config.ts';
import { compareStrings } from '../ordering.ts';

/** Declarations sorted by kind. */
export interface Declarations {
  /** Type declarations keyed by type name. */
  readonly types: Readonly<Record<string, TypeDeclaration>>;
  /** Method declarations keyed by method name. */
  readonly methods: Readonly<Record<string, MethodDeclaration>>;
  /** Enum declarations ordered by name. */
  readonly enums: readonly EnumDeclaration[];
}

interface Descriptor {
  readonly kind: string;
  readonly name: string;
}

const SUFFIX = '.ts';
const UNWRAP_LIMIT = 3;

/**
 * Loads the declarations out of `data`.
 *
 * One flat directory: `defineType` and `defineMethod` already record which kind
 * a file holds, so a directory per kind would write that twice.
 *
 * @param config engine settings
 * @returns declarations of types, methods and enums
 * @throws when a declaration is named differently from the file holding it
 */
export async function loadDeclarations(config: ResolvedConfig): Promise<Declarations> {
  const types: Record<string, TypeDeclaration> = {};
  const methods: Record<string, MethodDeclaration> = {};

  for (const entry of await declarationFiles(config.declarationsDir)) {
    const file = join(config.declarationsDir, entry);
    const descriptor = await readDescriptor(file);
    assertName(descriptor.name, entry.slice(0, -SUFFIX.length), file);

    if (descriptor.kind === 'type') {
      types[descriptor.name] = descriptor as TypeDeclaration;
      continue;
    }
    if (descriptor.kind === 'method') {
      methods[descriptor.name] = descriptor as MethodDeclaration;
      continue;
    }
    throw new Error(`${file}: expected a type or method declaration, got "${descriptor.kind}"`);
  }

  const enums: EnumDeclaration[] = [];
  for (const entry of await declarationFiles(config.enumsDir)) {
    const file = join(config.enumsDir, entry);
    const descriptor = await readDescriptor(file);
    if (descriptor.kind !== 'enum') {
      throw new Error(`${file}: expected an enum declaration, got "${descriptor.kind}"`);
    }
    assertName(descriptor.name, entry.slice(0, -SUFFIX.length), file);
    enums.push(descriptor as EnumDeclaration);
  }

  return { types, methods, enums };
}

/**
 * Lists the declaration files of a directory.
 *
 * Names differing only in case are refused. A type and a method could in
 * principle be spelled `Foo` and `foo`, and on a case-insensitive filesystem one
 * file would silently be the other. No such pair exists in the Bot API today,
 * and this is what keeps the day it grows one from being a mystery.
 */
async function declarationFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(SUFFIX))
    .map((entry) => entry.name)
    .toSorted(compareStrings);

  const folded = new Map<string, string>();
  for (const name of files) {
    const key = name.toLowerCase();
    const first = folded.get(key);
    if (first !== undefined) {
      throw new Error(
        `${dir}: "${first}" and "${name}" differ only in case and cannot both exist on every filesystem`,
      );
    }
    folded.set(key, name);
  }
  return files;
}

/**
 * Reads a declaration descriptor out of a module.
 *
 * Walks down `default` until a descriptor shows up: on the border between
 * module systems the value can end up wrapped more than once.
 */
async function readDescriptor(file: string): Promise<Descriptor> {
  let value: unknown = await import(pathToFileURL(file).href);
  for (let depth = 0; depth < UNWRAP_LIMIT && isWrapper(value); depth += 1) {
    value = value.default;
  }
  if (!isDescriptor(value)) {
    throw new Error(`${file}: the default export does not look like a declaration`);
  }
  return value;
}

function isWrapper(value: unknown): value is { default: unknown } {
  return typeof value === 'object' && value !== null && 'default' in value;
}

function isDescriptor(value: unknown): value is Descriptor {
  return typeof value === 'object' && value !== null && 'kind' in value && 'name' in value;
}

function assertName(declared: string, expected: string, file: string): void {
  if (declared !== expected) {
    throw new Error(`${file}: the declaration is named "${declared}" but sits as "${expected}"`);
  }
}
