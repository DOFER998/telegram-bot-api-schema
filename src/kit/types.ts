/** Semantic markers a field may carry beyond the type the documentation prints. */
export type FieldSemantic = 'unix_date';

/** Intent that cannot be derived from the scrape, for a single Bot API type. */
export interface TypeDeclarationOptions {
  /** Meaning a field's printed type does not carry: `Integer` that is a Unix timestamp. */
  readonly semantics?: Readonly<Record<string, FieldSemantic>>;
}

/** A type declaration: what goes into `data/types/<Name>/decl.ts`. */
export interface TypeDeclaration {
  /** Discriminates the kind of declaration. */
  readonly kind: 'type';
  /** Type name in the specification. */
  readonly name: string;
  /** Intent for this type. */
  readonly options: TypeDeclarationOptions;
}

/** Declares intent for a Bot API type. */
export function defineType(name: string, options: TypeDeclarationOptions): TypeDeclaration {
  return { kind: 'type', name, options };
}
