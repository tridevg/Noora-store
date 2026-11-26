import { addLine, removeLine, setQty, type CartLine } from './lines';

export type CartAction =
  | { type: 'add'; line: CartLine }
  | { type: 'setQty'; variantId: number; qty: number }
  | { type: 'remove'; variantId: number }
  | { type: 'clear' };

export function cartReducer(state: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case 'add':
      return addLine(state, action.line);
    case 'setQty':
      return setQty(state, action.variantId, action.qty);
    case 'remove':
      return removeLine(state, action.variantId);
    case 'clear':
      return [];
  }
}
