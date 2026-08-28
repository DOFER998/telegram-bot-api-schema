/** How the documentation writes a boolean, kept as three raw signals rather than one verdict. */
export interface BooleanFacts {
  /** `True` means the value only ever arrives true: present or absent, never false. */
  readonly type_column: 'True' | 'Boolean';
  /** The description opens with `Pass True`, so omitting the parameter says what false would. */
  readonly pass_true_prefix: boolean;
  /**
   * The description also speaks of `False`.
   *
   * Thirteen parameters set this alongside `pass_true_prefix`; there the two
   * signals disagree and only the description decides.
   */
  readonly false_documented: boolean;
}

/** A set of characters a value is restricted to, as the documentation marks it up. */
export interface Alphabet {
  /** Ranges written as `A-Z`. */
  readonly ranges: readonly string[];
  /** Single characters written on their own. */
  readonly characters: readonly string[];
}

/** A value the documentation pins down, together with the condition it holds under. */
export interface ConstantFact {
  /** The value, as JSON. */
  readonly value: string | number | boolean;
  /** The clause that qualifies it, when the documentation attaches one. */
  readonly condition?: string;
}

/** What one field's prose states beyond its name, type and description. */
export interface FieldFacts {
  /** Name of the type or method the field belongs to. */
  readonly entity: string;
  /** Name of the field or parameter. */
  readonly field: string;
  /** Which side of the API the field sits on. */
  readonly on: 'type' | 'method';
  /** Smallest accepted number. */
  readonly min?: number;
  /** Largest accepted number. */
  readonly max?: number;
  /** Smallest accepted length in characters. */
  readonly min_length?: number;
  /** Largest accepted length in characters. */
  readonly max_length?: number;
  /** Largest accepted number of elements, for a field typed as an array. */
  readonly max_items?: number;
  /** Smallest accepted number of elements, for a field typed as an array. */
  readonly min_items?: number;
  /** The value used when the field is omitted. */
  readonly default?: string | number | boolean | readonly string[];
  /** Name of the type the default is an instance of, where the documentation names one instead of a value. */
  readonly default_type?: string;
  /** Characters the value is restricted to. */
  readonly alphabet?: Alphabet;
  /** The values the documentation enumerates in quotation marks. */
  readonly one_of?: readonly string[];
  /** A value the documentation pins down rather than describes. */
  readonly constant?: ConstantFact;
  /** How the documentation writes this boolean. Absent for anything not boolean. */
  readonly boolean?: BooleanFacts;
  /** Methods that are the only place this field is populated. */
  readonly returned_only_in?: readonly string[];
  /** Fields that Telegram also populates whenever this one is populated. */
  readonly implies_set?: readonly string[];
  /** Significant bits the documentation warns the value may occupy. */
  readonly integer_bits?: number;
  /** Meaning the printed type does not carry, from a declaration. */
  readonly semantic?: string;
}
