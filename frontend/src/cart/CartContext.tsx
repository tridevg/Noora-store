import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import { cartReducer } from './reducer';
import { itemCount, loadCart, saveCart, subtotalPaise, type CartLine } from './lines';

export interface CartContextValue {
  lines: CartLine[];
  /** Total units across all lines. */
  itemCount: number;
  /** Integer paise. */
  subtotalPaise: number;
  addLine: (line: CartLine) => void;
  setQty: (variantId: number, qty: number) => void;
  removeLine: (variantId: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function initialLines(): CartLine[] {
  return typeof localStorage === 'undefined' ? [] : loadCart(localStorage);
}

/** Provides the cart to the tree. Persists to localStorage under CART_STORAGE_KEY. */
export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, dispatch] = useReducer(cartReducer, undefined, initialLines);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') saveCart(localStorage, lines);
  }, [lines]);

  const add = useCallback((line: CartLine) => dispatch({ type: 'add', line }), []);
  const setQty = useCallback(
    (variantId: number, qty: number) => dispatch({ type: 'setQty', variantId, qty }),
    [],
  );
  const remove = useCallback((variantId: number) => dispatch({ type: 'remove', variantId }), []);
  const clear = useCallback(() => dispatch({ type: 'clear' }), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      itemCount: itemCount(lines),
      subtotalPaise: subtotalPaise(lines),
      addLine: add,
      setQty,
      removeLine: remove,
      clear,
    }),
    [lines, add, setQty, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/** Access the cart. Must be used under CartProvider. */
export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside CartProvider');
  return value;
}
