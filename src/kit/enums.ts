/** Common part of every enum strategy. */
export interface EnumDescription {
  /** Documentation line in the output. Without it the builder states where the values came from. */
  readonly description?: string;
  /**
   * Members this enum types, as `Entity.field` or `*.field` for every entity
   * carrying a field of that name. A `parse` strategy types its own source
   * without repeating it here.
   */
  readonly applies?: readonly string[];
}

/** Value source: a regular expression over the markup of one field description. */
export interface EnumParseSource {
  /** Name of the type or method the field belongs to. */
  readonly entity: string;
  /** Name of the field or parameter. */
  readonly attribute: string;
  /** Expression with a single capturing group, applied to `html_description`. */
  readonly pattern: RegExp;
}

/** Value source: the field names of a type, minus the ones listed. */
export interface EnumExtractSource {
  /** Name of the type whose fields are enumerated. */
  readonly from: string;
  /** Fields that do not belong in the enum. */
  readonly exclude: readonly string[];
}

/** Values written out by hand, because the specification never lists them. */
export interface StaticEnumDeclaration extends EnumDescription {
  /** Key in the output mapped to the value on the wire. */
  readonly static: Readonly<Record<string, string>>;
}

/** Values pulled out of the description markup by a regular expression. */
export interface ParseEnumDeclaration extends EnumDescription {
  /** Where to look and what to look for. */
  readonly parse: EnumParseSource;
}

/** Values are the field names of a type. */
export interface ExtractEnumDeclaration extends EnumDescription {
  /** Which type to read and what to skip. */
  readonly extract: EnumExtractSource;
}

/**
 * Strategy for obtaining the values of an enum.
 *
 * Discriminators of abstract types are a fourth strategy and need no
 * declaration: the builder derives them.
 */
export type EnumDeclarationOptions =
  | StaticEnumDeclaration
  | ParseEnumDeclaration
  | ExtractEnumDeclaration;

/** An enum declaration: what goes into `data/enums/<Name>.ts`. */
export interface EnumDeclaration {
  /** Discriminates the kind of declaration. */
  readonly kind: 'enum';
  /** Name of the enum in the output. */
  readonly name: string;
  /** Strategy for obtaining the values. */
  readonly options: EnumDeclarationOptions;
}

/** Declares an enum whose values the documentation does not hand over directly. */
export function defineEnum(name: string, options: EnumDeclarationOptions): EnumDeclaration {
  return { kind: 'enum', name, options };
}
