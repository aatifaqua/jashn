import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(import.meta.dirname, 'app.css'), 'utf8');

/** The print block, from "@media print" to the end of its braces. */
function printBlock(text: string): string {
  const start = text.indexOf('@media print');
  let depth = 0;
  for (let index = text.indexOf('{', start); index < text.length; index += 1) {
    if (text[index] === '{') depth += 1;
    if (text[index] === '}') depth -= 1;
    if (depth === 0) return text.slice(start, index + 1);
  }
  return '';
}

describe('print stylesheet', () => {
  it('outranks both dark-theme selectors, so a dark-theme plan prints black on white', () => {
    const print = printBlock(css);
    const tokens = print.slice(0, print.indexOf('}'));
    expect(tokens).toContain(':root[data-theme]');
    expect(tokens).toContain(":root:not([data-theme='light'])");
    expect(tokens).toContain('color-scheme: light');
    for (const token of ['--ink: #000', '--ink-muted: #333', '--bg: #fff', '--bar:', '--brand:']) {
      expect(tokens).toContain(token);
    }
    // Later in the file than the dark blocks, so equal specificity resolves to print.
    expect(css.indexOf(print)).toBeGreaterThan(css.indexOf(":root[data-theme='dark']"));
  });
});
