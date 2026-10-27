import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CONSTRAINTS } from './ids.ts';
import { normaliseInput } from './input.ts';
import { decodeShare, encodeShare } from './share.ts';
import { TODAY, sampleInput } from './test-fixtures.ts';

function encodeRaw(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('encodeShare / decodeShare', () => {
  it('round-trips the sample input, with or without the leading #', () => {
    const input = sampleInput({
      note: "Mehndi on the terrace, Dadi's café \u{1F389}",
      venueBooked: true,
    });
    const code = encodeShare(input);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeShare(code, TODAY)).toEqual(normaliseInput(input));
    expect(decodeShare(`#${code}`, TODAY)).toEqual(normaliseInput(input));
  });

  it('round-trips any valid choice of needs, guests and budget', () => {
    fc.assert(
      fc.property(
        fc.subarray([...CONSTRAINTS]),
        fc.integer({ min: 1, max: 5000 }),
        fc.integer({ min: 1000, max: 100_000_000 }),
        fc.boolean(),
        (constraints, invited, budget, venueBooked) => {
          const input = sampleInput({ constraints, invited, budget, venueBooked });
          expect(decodeShare(encodeShare(input), TODAY)).toEqual(normaliseInput(input));
        },
      ),
    );
  });

  it('still opens an older link that carries an extra trailing entry', () => {
    const input = sampleInput();
    const code = encodeShare(input);
    const fields = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(code.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
      ),
    ) as unknown[];
    expect(decodeShare(encodeRaw([...fields, 0]), TODAY)).toEqual(normaliseInput(input));
  });

  it('gives equal links for equal events', () => {
    const a = sampleInput({ constraints: ['jain', 'halal'] });
    const b = sampleInput({ constraints: ['halal', 'jain', 'jain'] });
    expect(encodeShare(a)).toBe(encodeShare(b));
  });

  it('rejects malformed, foreign-version, tampered and invalid payloads', () => {
    const valid = encodeShare(sampleInput());
    expect(decodeShare('', TODAY)).toBeNull();
    expect(decodeShare('#', TODAY)).toBeNull();
    expect(decodeShare('not base64!', TODAY)).toBeNull();
    expect(decodeShare('A', TODAY)).toBeNull();
    expect(decodeShare('x'.repeat(5000), TODAY)).toBeNull();
    expect(decodeShare(encodeRaw('just a string'), TODAY)).toBeNull();
    expect(decodeShare(encodeRaw({ type: 'wedding' }), TODAY)).toBeNull();
    expect(decodeShare('_w', TODAY)).toBeNull();
    expect(decodeShare(valid, TODAY + 400)).toBeNull();
    const fields = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(valid.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
      ),
    ) as unknown[];
    expect(decodeShare(encodeRaw([2, ...fields.slice(1)]), TODAY)).toBeNull();
    const tamper = (index: number, value: unknown): string =>
      encodeRaw(fields.map((field, i) => (i === index ? value : field)));
    expect(decodeShare(tamper(1, 9), TODAY)).toBeNull();
    expect(decodeShare(tamper(1, 'wedding'), TODAY)).toBeNull();
    expect(decodeShare(tamper(9, true), TODAY)).toBeNull();
    expect(decodeShare(tamper(13, 'jain'), TODAY)).toBeNull();
    expect(decodeShare(tamper(13, [99]), TODAY)).toBeNull();
    expect(decodeShare(tamper(11, 1e12), TODAY)).toBeNull();
    expect(decodeShare(tamper(9, 0), TODAY)).not.toBeNull();
  });
});
