import { describe, expect, it } from 'vitest';
import { buildWhatsAppUrl } from '@beauty-store/shared';
import {
  addLine,
  CART_STORAGE_KEY,
  loadCart,
  MAX_LINE_QTY,
  saveCart,
  setQty,
  subtotalPaise,
  type CartLine,
} from '../../../cart/lines';
import {
  parseCatalogParams,
  rupeesToPaise,
  toApiQuery,
  toSearchParams,
  type CatalogFilters,
} from '../catalogQuery';
import { buildOrderWhatsAppUrl } from '../orderWhatsApp';
import { fieldForPath, validateCheckout } from '../checkout';

const shirt: CartLine = {
  productId: 1,
  variantId: 10,
  slug: 'silk-saree-red',
  name: 'Silk saree',
  size: 'M',
  colour: 'Red',
  unitPricePaise: 129900,
  qty: 1,
};

const kurta: CartLine = {
  ...shirt,
  productId: 2,
  variantId: 20,
  name: 'Cotton kurta',
  unitPricePaise: 49950,
  qty: 2,
};

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const store = new Map(Object.entries(initial));
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => void store.delete(key),
    setItem: (key: string, value: string) => void store.set(key, value),
  } as Storage;
}

describe('cart lines', () => {
  it('merges a repeated variant and caps the quantity at 20', () => {
    const once = addLine([], shirt);
    const twice = addLine(once, { ...shirt, qty: 19 });
    expect(twice).toHaveLength(1);
    expect(twice[0]?.qty).toBe(MAX_LINE_QTY);
  });

  it('removes a line when quantity is set to 0', () => {
    expect(setQty([shirt, kurta], 10, 0)).toEqual([kurta]);
  });

  it('sums subtotal in integer paise', () => {
    expect(subtotalPaise([shirt, kurta])).toBe(129900 + 49950 * 2);
  });

  it('loads corrupt JSON and malformed entries as an empty or filtered cart', () => {
    expect(loadCart(memoryStorage({ [CART_STORAGE_KEY]: '{not json' }))).toEqual([]);
    const mixed = JSON.stringify([shirt, { productId: 'x', qty: 1 }, { ...kurta, qty: 99 }]);
    expect(loadCart(memoryStorage({ [CART_STORAGE_KEY]: mixed }))).toEqual([shirt]);
  });

  it('round-trips through saveCart and loadCart', () => {
    const storage = memoryStorage();
    saveCart(storage, [shirt, kurta]);
    expect(loadCart(storage)).toEqual([shirt, kurta]);
  });
});

describe('WhatsApp builders', () => {
  it('keeps digits only and encodes the text', () => {
    const url = buildWhatsAppUrl('+91 98765-43210', 'Hi & bye');
    expect(url).toBe('https://wa.me/919876543210?text=Hi%20%26%20bye');
  });

  it('rejects numbers with fewer than 8 digits', () => {
    expect(() => buildWhatsAppUrl('12-34', 'hi')).toThrow(RangeError);
  });

  it('builds the order link with ID, items, total, address and payment mode', () => {
    const url = buildOrderWhatsAppUrl('+91 98765 43210', {
      orderId: 42,
      totalPaise: 129900 + 49950 * 2,
      customerName: 'Asha',
      customerPhone: '9876543210',
      address: '12 MG Road, Pune',
      lines: [shirt, kurta],
    });
    const text = decodeURIComponent(url.split('?text=')[1] ?? '');
    expect(url.startsWith('https://wa.me/919876543210?text=')).toBe(true);
    expect(text).toContain('Order ID: #42');
    expect(text).toContain('- Silk saree (M / Red) x 1 @ ₹1,299');
    expect(text).toContain('- Cotton kurta (M / Red) x 2 @ ₹499.50');
    expect(text).toContain('Total: ₹2,298');
    expect(text).toContain('Address: 12 MG Road, Pune');
    expect(text).toContain('Cash / UPI on Delivery');
  });
});

describe('catalogue query', () => {
  it('converts whole rupees to paise and rejects other text', () => {
    expect(rupeesToPaise('500')).toBe(50000);
    expect(rupeesToPaise(' 0 ')).toBe(0);
    expect(rupeesToPaise('')).toBeUndefined();
    expect(rupeesToPaise('12.5')).toBeUndefined();
    expect(rupeesToPaise('-3')).toBeUndefined();
  });

  it('builds the API query and leaves out blank filters', () => {
    const filters: CatalogFilters = {
      q: ' silk ',
      category: 'sarees',
      minRupees: '500',
      maxRupees: '',
      size: '',
      colour: 'red',
      inStock: true,
      sort: 'price_asc',
      page: 2,
    };
    const query = new URLSearchParams(toApiQuery(filters));
    expect(Object.fromEntries(query)).toEqual({
      q: 'silk',
      category: 'sarees',
      min_price: '50000',
      colour: 'red',
      in_stock: '1',
      sort: 'price_asc',
      page: '2',
      per_page: '24',
    });
  });

  it('round-trips URL state and omits category on pinned routes', () => {
    const params = new URLSearchParams('sort=popularity&page=3&min=100');
    const parsed = parseCatalogParams(params, 'bridal');
    expect(parsed.category).toBe('bridal');
    expect(parsed.sort).toBe('popularity');
    expect(parsed.page).toBe(3);
    expect(toSearchParams(parsed, false).has('category')).toBe(false);
    expect(toSearchParams(parsed, false).get('min')).toBe('100');
  });

  it('falls back to safe defaults for bad sort and page values', () => {
    const parsed = parseCatalogParams(new URLSearchParams('sort=rating&page=-4'));
    expect(parsed.sort).toBe('newest');
    expect(parsed.page).toBe(1);
  });
});

describe('checkout validation', () => {
  const form = { name: 'Asha', phone: '9876543210', address: '12 MG Road' };

  it('accepts a complete form and returns an id-only payload', () => {
    const result = validateCheckout(form, [shirt]);
    expect(result).toEqual({
      ok: true,
      payload: {
        customer_name: 'Asha',
        customer_phone: '9876543210',
        address: '12 MG Road',
        items: [{ product_id: 1, variant_id: 10, qty: 1 }],
      },
    });
  });

  it('reports each invalid field with an en.ts message', () => {
    const result = validateCheckout({ name: ' ', phone: 'abc', address: '' }, [shirt]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(['address', 'name', 'phone']);
    expect(result.errors.phone).toMatch(/valid phone number/);
  });

  it('rejects an empty cart under the items field', () => {
    const result = validateCheckout(form, []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.items).toBeDefined();
  });

  it('maps server field names to form fields', () => {
    expect(fieldForPath('customer_phone')).toBe('phone');
    expect(fieldForPath('items.0.qty')).toBe('items');
  });
});
