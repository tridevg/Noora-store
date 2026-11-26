import { z } from 'zod';

/** Integer paise, never a float. */
export const PaiseSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

/** Lowercase kebab-case slug: "silk-saree-red" passes, "Bad Slug" fails. */
export const SlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase kebab-case');

/** Positive integer row id. */
export const IdSchema = z.number().int().positive();

/** Non-empty trimmed text with a maximum length. */
export const trimmedText = (max: number) => z.string().trim().min(1).max(max);

/** Query-string page number (defaults to 1). */
export const PageSchema = z.coerce.number().int().min(1).default(1);

/** Query-string page size: 1..48, defaults to 24. */
export const PerPageSchema = z.coerce.number().int().min(1).max(48).default(24);
