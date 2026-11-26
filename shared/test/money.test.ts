import { describe, expect, it } from 'vitest';
import { formatPaise, percentOff, sumPaise } from '../src/index';

describe('formatPaise', () => {
  it('formats whole rupees with Indian grouping', () => {
    expect(formatPaise(129900)).toBe('₹1,299');
    expect(formatPaise(0)).toBe('₹0');
    expect(formatPaise(100000000)).toBe('₹10,00,000');
  });

  it('shows two decimals only when paise are present', () => {
    expect(formatPaise(129950)).toBe('₹1,299.50');
    expect(formatPaise(5)).toBe('₹0.05');
  });

  it('throws RangeError for non-integer or negative input', () => {
    expect(() => formatPaise(1.5)).toThrow(RangeError);
    expect(() => formatPaise(-1)).toThrow(RangeError);
    expect(() => formatPaise(Number.NaN)).toThrow(RangeError);
  });
});

describe('percentOff', () => {
  it('computes integer percentages', () => {
    expect(percentOff(10000, 7500)).toBe(25);
    expect(percentOff(10000, 10000)).toBe(0);
    expect(percentOff(10000, 0)).toBe(100);
  });

  it('rounds half-up', () => {
    // 1/8 = 12.5% rounds to 13
    expect(percentOff(800, 700)).toBe(13);
    // 1/3 = 33.33% rounds to 33
    expect(percentOff(300, 200)).toBe(33);
  });

  it('returns 0 when mrp is 0', () => {
    expect(percentOff(0, 0)).toBe(0);
  });

  it('clamps prices above mrp to 0', () => {
    expect(percentOff(1000, 1200)).toBe(0);
  });

  it('rejects non-integer paise', () => {
    expect(() => percentOff(1000.5, 500)).toThrow(RangeError);
  });
});

describe('sumPaise', () => {
  it('sums integer paise', () => {
    expect(sumPaise([129900, 50])).toBe(129950);
    expect(sumPaise([])).toBe(0);
  });

  it('rejects floats and negatives', () => {
    expect(() => sumPaise([1.5])).toThrow(RangeError);
    expect(() => sumPaise([-1])).toThrow(RangeError);
  });
});
