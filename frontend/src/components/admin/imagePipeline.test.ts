import { describe, expect, it } from 'vitest';
import {
  AdminImageError,
  FULL_MAX_BYTES,
  THUMB_MAX_BYTES,
  encodePlan,
  evaluateVariant,
  extensionFor,
  fitWithin,
  isImageFile,
  needsJpegFallback,
} from './imagePipeline';

describe('encodePlan', () => {
  it('uses WebP q0.82 for full and q0.75 for thumb, with JPEG q0.82 as fallback', () => {
    expect(encodePlan('full')[0]).toEqual({ mime: 'image/webp', quality: 0.82 });
    expect(encodePlan('thumb')[0]).toEqual({ mime: 'image/webp', quality: 0.75 });
    expect(encodePlan('full')[1]).toEqual({ mime: 'image/jpeg', quality: 0.82 });
    expect(encodePlan('thumb')[1]).toEqual({ mime: 'image/jpeg', quality: 0.82 });
  });
});

describe('needsJpegFallback', () => {
  it('falls back when the browser returned anything other than WebP (PNG fallback case)', () => {
    expect(needsJpegFallback('image/png')).toBe(true);
    expect(needsJpegFallback('')).toBe(true);
    expect(needsJpegFallback('image/webp')).toBe(false);
  });
});

describe('evaluateVariant', () => {
  it('accepts WebP and JPEG within limits', () => {
    expect(evaluateVariant('full', { type: 'image/webp', size: 1000 })).toEqual({
      ok: true,
      mime: 'image/webp',
    });
    expect(evaluateVariant('thumb', { type: 'image/jpeg', size: 1000 })).toEqual({
      ok: true,
      mime: 'image/jpeg',
    });
  });

  it('rejects a type other than image/webp or image/jpeg', () => {
    expect(evaluateVariant('full', { type: 'image/png', size: 10 })).toEqual({
      ok: false,
      code: 'unsupported_output',
    });
  });

  it('enforces the full limit of 500 KB and the thumb limit of 300 KB inclusively', () => {
    expect(evaluateVariant('full', { type: 'image/webp', size: FULL_MAX_BYTES }).ok).toBe(true);
    expect(evaluateVariant('full', { type: 'image/webp', size: FULL_MAX_BYTES + 1 })).toEqual({
      ok: false,
      code: 'output_too_large',
    });
    expect(evaluateVariant('thumb', { type: 'image/webp', size: THUMB_MAX_BYTES }).ok).toBe(true);
    expect(evaluateVariant('thumb', { type: 'image/webp', size: THUMB_MAX_BYTES + 1 })).toEqual({
      ok: false,
      code: 'output_too_large',
    });
  });

  it('keeps the thumb limit tighter than the full limit', () => {
    const size = 400_000;
    expect(evaluateVariant('full', { type: 'image/jpeg', size }).ok).toBe(true);
    expect(evaluateVariant('thumb', { type: 'image/jpeg', size }).ok).toBe(false);
  });
});

describe('extensionFor', () => {
  it('matches the upload key extension to the bytes', () => {
    expect(extensionFor('image/webp')).toBe('webp');
    expect(extensionFor('image/jpeg')).toBe('jpg');
  });
});

describe('isImageFile', () => {
  it('accepts image MIME types for decoding and rejects everything else', () => {
    expect(isImageFile({ type: 'image/png' })).toBe(true);
    expect(isImageFile({ type: 'application/pdf' })).toBe(false);
    expect(isImageFile({ type: '' })).toBe(false);
  });
});

describe('fitWithin', () => {
  it('scales the long edge down to the limit and keeps the aspect ratio', () => {
    expect(fitWithin(3200, 1600, 1600)).toEqual({ width: 1600, height: 800 });
    expect(fitWithin(800, 2000, 400)).toEqual({ width: 160, height: 400 });
  });

  it('never scales up', () => {
    expect(fitWithin(300, 200, 1600)).toEqual({ width: 300, height: 200 });
  });
});

describe('AdminImageError', () => {
  it('carries the code used for i18n lookup', () => {
    const error = new AdminImageError('not_image');
    expect(error.code).toBe('not_image');
    expect(error).toBeInstanceOf(Error);
  });
});
