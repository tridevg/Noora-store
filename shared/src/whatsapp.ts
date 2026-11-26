import { formatPaise } from './money';

export interface OrderMessageItem {
  name: string;
  size: string;
  colour: string;
  qty: number;
  unitPricePaise: number;
}

export interface OrderMessageInput {
  orderId: number | string;
  items: readonly OrderMessageItem[];
  totalPaise: number;
  address: string;
  customerName: string;
  customerPhone: string;
}

export interface EnquiryMessageInput {
  serviceName: string;
  businessName: string;
}

/** Builds https://wa.me/<digits>?text=<encoded>. Throws when fewer than 8 digits remain. */
export function buildWhatsAppUrl(number: string, text: string): string {
  const digits = number.replace(/\D/g, '');
  if (digits.length < 8) {
    throw new RangeError('WhatsApp number must contain at least 8 digits');
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** Plain-text order summary sent to the business on WhatsApp. */
export function buildOrderMessage(input: OrderMessageInput): string {
  const lines = input.items.map(
    (item) =>
      `- ${item.name} (${item.size} / ${item.colour}) x ${item.qty} @ ${formatPaise(item.unitPricePaise)}`,
  );
  return [
    `Order ID: #${input.orderId}`,
    `Name: ${input.customerName}`,
    `Phone: ${input.customerPhone}`,
    `Address: ${input.address}`,
    '',
    'Items:',
    ...lines,
    '',
    `Total: ${formatPaise(input.totalPaise)}`,
    'Payment: Cash / UPI on Delivery',
  ].join('\n');
}

/** Opening message for a service enquiry on WhatsApp. */
export function buildEnquiryMessage(input: EnquiryMessageInput): string {
  return `Hi ${input.businessName}, I would like to enquire about ${input.serviceName}.`;
}
