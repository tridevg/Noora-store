// Builds the WhatsApp hand-off for a placed order. Uses the shared WhatsApp builders only.
import { buildOrderMessage, buildWhatsAppUrl } from '@beauty-store/shared';
import type { CartLine } from '../../cart';

export interface PlacedOrderMessage {
  orderId: number | string;
  totalPaise: number;
  customerName: string;
  customerPhone: string;
  address: string;
  lines: readonly CartLine[];
}

/** wa.me link carrying the order summary. Throws RangeError when the stored number is unusable. */
export function buildOrderWhatsAppUrl(whatsappNumber: string, order: PlacedOrderMessage): string {
  const text = buildOrderMessage({
    orderId: order.orderId,
    totalPaise: order.totalPaise,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    address: order.address,
    items: order.lines.map((line) => ({
      name: line.name,
      size: line.size,
      colour: line.colour,
      qty: line.qty,
      unitPricePaise: line.unitPricePaise,
    })),
  });
  return buildWhatsAppUrl(whatsappNumber, text);
}
