/** A single enum member. */
export interface EnumValue {
  /** Member name in the output, PascalCase. */
  readonly member: string;
  /** Value on the wire. */
  readonly value: string;
}

/** A finished enum of the output. */
export interface ResolvedEnum {
  /** Name of the enum. */
  readonly name: string;
  /** Documentation line. */
  readonly description: string;
  /** Anchor of the source entity in the documentation, when there is one. */
  readonly anchor?: string;
  /** Values in documentation order. */
  readonly values: readonly EnumValue[];
}
