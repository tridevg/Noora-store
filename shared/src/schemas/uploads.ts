import { z } from 'zod';

/** Upload key: products/<id>/<uuid>-(full|thumb).(webp|jpg). */
export const UploadKeySchema = z
  .string()
  .regex(/^products\/\d+\/[0-9a-f-]{36}-(full|thumb)\.(webp|jpg)$/, 'invalid upload key');
