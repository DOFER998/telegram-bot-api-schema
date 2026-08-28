const CONTEXT = 60;

/**
 * Describes where two texts first differ.
 *
 * The texts are megabytes long, so "they differ" is not actionable on its own.
 *
 * @param leftLabel name of the first text
 * @param left the first text
 * @param rightLabel name of the second text
 * @param right the second text
 * @returns a message naming the position and showing both sides
 */
export function describeDifference(
  leftLabel: string,
  left: string,
  rightLabel: string,
  right: string,
): string {
  const at = firstDifferenceAt(left, right);
  const line = left.slice(0, at).split('\n').length;
  const from = Math.max(0, at - CONTEXT);
  return [
    `The two differ — line ${line}, offset ${at}:`,
    `  ${leftLabel}: ...${left.slice(from, at + CONTEXT)}...`,
    `  ${rightLabel}: ...${right.slice(from, at + CONTEXT)}...`,
  ].join('\n');
}

function firstDifferenceAt(left: string, right: string): number {
  const shortest = Math.min(left.length, right.length);
  for (let at = 0; at < shortest; at += 1) {
    if (left[at] !== right[at]) {
      return at;
    }
  }
  return shortest;
}
