import { describe, expect, it } from 'vitest';
import { paiseToRupeesInput, parseRupeesToPaise } from './money';

describe('parseRupeesToPaise', () => {
  it('converts whole and fractional rupees to integer paise', () => {
    expect(parseRupeesToPaise('1299')).toBe(129900);
    expect(parseRupeesToPaise('1299.5')).toBe(129950);
    expect(parseRupeesToPaise('1,299.50')).toBe(129950);
    expect(parseRupeesToPaise('0.05')).toBe(5);
  });

  it('rejects negatives, floats with more than two decimals, and text', () => {
    expect(parseRupeesToPaise('-1')).toBeNull();
    expect(parseRupeesToPaise('1.234')).toBeNull();
    expect(parseRupeesToPaise('abc')).toBeNull();
    expect(parseRupeesToPaise('')).toBeNull();
  });
});

describe('paiseToRupeesInput', () => {
  it('formats paise with two decimals', () => {
    expect(paiseToRupeesInput(129950)).toBe('1299.50');
    expect(paiseToRupeesInput(0)).toBe('0.00');
  });
});
