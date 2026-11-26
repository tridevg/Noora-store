// Client-side image pipeline for admin uploads (.claude/architecture.md section 4).
// Runs only in the browser. The Worker never decodes or re-encodes images.
// The decision functions are pure so they can be unit tested without a DOM.

export const FULL_MAX_EDGE = 1600;
export const FULL_QUALITY = 0.82;
export const THUMB_MAX_EDGE = 400;
export const THUMB_QUALITY = 0.75;
/** Decimal bytes, so the limit is also met when "3 MB" is read as 3,000,000. */
export const FULL_MAX_BYTES = 3_000_000;
export const THUMB_MAX_BYTES = 300_000;
export const JPEG_FALLBACK_QUALITY = 0.82;

export type VariantKind = 'full' | 'thumb';
export type OutputMime = 'image/webp' | 'image/jpeg';
export type ImageErrorCode = 'not_image' | 'unsupported_output' | 'output_too_large';

export class AdminImageError extends Error {
  readonly code: ImageErrorCode;

  constructor(code: ImageErrorCode) {
    super(code);
    this.name = 'AdminImageError';
    this.code = code;
  }
}

export interface EncodeStep {
  mime: OutputMime;
  quality: number;
}

export const VARIANT_SPEC: Record<
  VariantKind,
  { maxEdge: number; maxBytes: number; quality: number }
> = {
  full: { maxEdge: FULL_MAX_EDGE, maxBytes: FULL_MAX_BYTES, quality: FULL_QUALITY },
  thumb: { maxEdge: THUMB_MAX_EDGE, maxBytes: THUMB_MAX_BYTES, quality: THUMB_QUALITY },
};

/** Browser-level check on the input file. Any image type may be decoded. */
export function isImageFile(file: { type: string }): boolean {
  return file.type.startsWith('image/');
}

/** Scales (width, height) down so the longest edge fits maxEdge. Never scales up. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** The encode attempts for a variant, in order: WebP first, JPEG fallback second. */
export function encodePlan(kind: VariantKind): [EncodeStep, EncodeStep] {
  return [
    { mime: 'image/webp', quality: VARIANT_SPEC[kind].quality },
    { mime: 'image/jpeg', quality: JPEG_FALLBACK_QUALITY },
  ];
}

/** True when the browser did not produce WebP and the JPEG encode must run (R13). */
export function needsJpegFallback(resultType: string): boolean {
  return resultType !== 'image/webp';
}

export function isAcceptedOutput(mime: string): mime is OutputMime {
  return mime === 'image/webp' || mime === 'image/jpeg';
}

export type VariantVerdict =
  { ok: true; mime: OutputMime } | { ok: false; code: 'unsupported_output' | 'output_too_large' };

/** Final check on an encoded blob: accepted type, then size limit (R8). */
export function evaluateVariant(
  kind: VariantKind,
  blob: { type: string; size: number },
): VariantVerdict {
  if (!isAcceptedOutput(blob.type)) return { ok: false, code: 'unsupported_output' };
  if (blob.size > VARIANT_SPEC[kind].maxBytes) return { ok: false, code: 'output_too_large' };
  return { ok: true, mime: blob.type };
}

/** File extension that matches the bytes, as required by UploadKeySchema. */
export function extensionFor(mime: OutputMime): 'webp' | 'jpg' {
  return mime === 'image/webp' ? 'webp' : 'jpg';
}

async function renderBlob(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  step: EncodeStep,
): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new AdminImageError('unsupported_output');
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas.convertToBlob({ type: step.mime, quality: step.quality });
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new AdminImageError('unsupported_output');
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, step.mime, step.quality),
  );
  if (!blob) throw new AdminImageError('unsupported_output');
  return blob;
}

async function encodeVariant(bitmap: ImageBitmap, kind: VariantKind): Promise<Blob> {
  const { maxEdge } = VARIANT_SPEC[kind];
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);
  const [webp, jpeg] = encodePlan(kind);
  let blob = await renderBlob(bitmap, width, height, webp);
  if (needsJpegFallback(blob.type)) {
    blob = await renderBlob(bitmap, width, height, jpeg);
  }
  const verdict = evaluateVariant(kind, blob);
  if (!verdict.ok) throw new AdminImageError(verdict.code);
  return blob;
}

/**
 * Produces the full (<= 1600 px, WebP q0.82) and thumb (<= 400 px, WebP q0.75) blobs.
 * Each blob is image/webp, or image/jpeg when the browser cannot encode WebP.
 */
export async function toWebpVariants(file: File): Promise<{ full: Blob; thumb: Blob }> {
  if (!isImageFile(file)) throw new AdminImageError('not_image');
  const bitmap = await createImageBitmap(file);
  try {
    const full = await encodeVariant(bitmap, 'full');
    const thumb = await encodeVariant(bitmap, 'thumb');
    return { full, thumb };
  } finally {
    bitmap.close();
  }
}
