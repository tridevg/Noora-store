import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

// The drawer is only fetched when the bag is first opened, so it stays out of the initial bundle.
const CartDrawer = lazy(() => import('./CartDrawer'));

interface BagContextValue {
  /** Opens the slide-over bag. Focus returns to the element that opened it when it closes. */
  openBag: () => void;
}

const BagContext = createContext<BagContextValue | null>(null);

/** Owns whether the bag drawer is open. The drawer is mounted only while open. */
export function BagProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openBag = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ openBag }), [openBag]);

  return (
    <BagContext.Provider value={value}>
      {children}
      {open ? (
        <Suspense fallback={null}>
          <CartDrawer onClose={close} />
        </Suspense>
      ) : null}
    </BagContext.Provider>
  );
}

export function useBag(): BagContextValue {
  const value = useContext(BagContext);
  if (!value) throw new Error('useBag must be used inside BagProvider');
  return value;
}
