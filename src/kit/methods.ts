import type { FieldSemantic } from './types.ts';

/** Intent that cannot be derived from the scrape, for a single Bot API method. */
export interface MethodDeclarationOptions {
  /**
   * Return types, overriding whatever the scrape read out of the prose.
   *
   * The message-editing methods return `Message` for an ordinary message and
   * `True` for an inline one; no pattern can pick between the two.
   */
  readonly returns?: readonly string[];
  /** Meaning a parameter's printed type does not carry. As for types. */
  readonly semantics?: Readonly<Record<string, FieldSemantic>>;
}

/** A method declaration: what goes into `data/methods/<name>/decl.ts`. */
export interface MethodDeclaration {
  /** Discriminates the kind of declaration. */
  readonly kind: 'method';
  /** Method name in the specification. */
  readonly name: string;
  /** Intent for this method. */
  readonly options: MethodDeclarationOptions;
}

/** Declares intent for a Bot API method. */
export function defineMethod(name: string, options: MethodDeclarationOptions): MethodDeclaration {
  return { kind: 'method', name, options };
}
