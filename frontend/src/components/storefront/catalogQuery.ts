// Pure helpers that map catalogue filter state to URL search params and the /api/products query.
// Filter state lives in the URL so filtered views can be shared and survive reloads.
// Mirrors ProductSortSchema in @beauty-store/shared.
export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'popularity';

export const SORTS: readonly ProductSort[] = ['newest', 'price_asc', 'price_desc', 'popularity'];
export const PER_PAGE = 24;

export interface CatalogFilters {
  q: string;
  category: string;
  /** Rupee text as typed, e.g. "500". Converted to paise only when querying. */
  minRupees: string;
  maxRupees: string;
  size: string;
  colour: string;
  inStock: boolean;
  sort: ProductSort;
  page: number;
}

/** Converts whole rupees typed by the user to integer paise. Returns undefined for blank or invalid text. */
export function rupeesToPaise(text: string): number | undefined {
  const trimmed = text.trim();
  if (!/^\d{1,9}$/.test(trimmed)) return undefined;
  return Number(trimmed) * 100;
}

export function parseCatalogParams(params: URLSearchParams, categorySlug?: string): CatalogFilters {
  const sortParam = params.get('sort') ?? '';
  const sort = (SORTS as readonly string[]).includes(sortParam)
    ? (sortParam as ProductSort)
    : 'newest';
  const page = Number.parseInt(params.get('page') ?? '1', 10);
  return {
    q: params.get('q') ?? '',
    category: categorySlug ?? params.get('category') ?? '',
    minRupees: params.get('min') ?? '',
    maxRupees: params.get('max') ?? '',
    size: params.get('size') ?? '',
    colour: params.get('colour') ?? '',
    inStock: params.get('in_stock') === '1',
    sort,
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1,
  };
}

/** URL search params for the filter state. The category is omitted on /category/:slug routes. */
export function toSearchParams(filters: CatalogFilters, includeCategory: boolean): URLSearchParams {
  const params = new URLSearchParams();
  const put = (key: string, value: string) => {
    if (value !== '') params.set(key, value);
  };
  put('q', filters.q.trim());
  if (includeCategory) put('category', filters.category);
  put('min', filters.minRupees.trim());
  put('max', filters.maxRupees.trim());
  put('size', filters.size.trim());
  put('colour', filters.colour.trim());
  if (filters.inStock) params.set('in_stock', '1');
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  if (filters.page > 1) params.set('page', String(filters.page));
  return params;
}

/** Query string for GET /api/products. Blank filters are left out. */
export function toApiQuery(filters: CatalogFilters): string {
  const params = new URLSearchParams();
  const q = filters.q.trim();
  if (q) params.set('q', q);
  if (filters.category) params.set('category', filters.category);
  const min = rupeesToPaise(filters.minRupees);
  const max = rupeesToPaise(filters.maxRupees);
  if (min !== undefined) params.set('min_price', String(min));
  if (max !== undefined) params.set('max_price', String(max));
  if (filters.size.trim()) params.set('size', filters.size.trim());
  if (filters.colour.trim()) params.set('colour', filters.colour.trim());
  if (filters.inStock) params.set('in_stock', '1');
  params.set('sort', filters.sort);
  params.set('page', String(filters.page));
  params.set('per_page', String(PER_PAGE));
  return params.toString();
}
