/**
 * Turns an entity name into the kebab-case form used for file names.
 *
 * @param name name of a type or a method: `UserProfile`, `getUserProfile`
 * @returns `user-profile`, `get-user-profile`
 */
export function kebabCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/gu, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/gu, '$1-$2')
    .toLowerCase();
}

/**
 * Turns snake_case into PascalCase.
 *
 * @param name member name: `status`, `page_size`
 * @returns `Status`, `PageSize`
 */
export function pascalCase(name: string): string {
  return name
    .split('_')
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Turns a wire value or a hand-written key into an enum member name.
 *
 * Runs of capitals collapse, so `HTML` reads as `Html` rather than shouting;
 * a trailing version digit stays attached, so `MarkdownV2` survives intact.
 *
 * @param value wire value or declared key: `upload_photo`, `HTML`, `SLOT_MACHINE`
 * @returns `UploadPhoto`, `Html`, `SlotMachine`
 */
export function memberName(value: string): string {
  return value
    .split(/[^A-Za-z0-9]+/u)
    .flatMap((part) => part.replace(/([a-z0-9])([A-Z])/gu, '$1 $2').split(' '))
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}
