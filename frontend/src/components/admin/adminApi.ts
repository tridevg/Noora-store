// Admin-side reads that are not admin routes. Categories are seeded only (plan R9), and
// the schema has no admin categories endpoint, so the public read is used for the picker.
import type { CategoryDto, CategoryType } from '@beauty-store/shared';
import { apiGet } from '../../lib/api';

export async function fetchCategories(
  signal: AbortSignal,
  type: CategoryType,
): Promise<CategoryDto[]> {
  const response = await apiGet<{ categories: CategoryDto[] }>('/api/categories', signal);
  return response.categories.filter((category) => category.type === type);
}
