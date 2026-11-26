import { describe, expect, it } from 'vitest';
import { buildEnquiryMessage, buildOrderMessage, buildWhatsAppUrl } from '../src/index';

describe('buildWhatsAppUrl', () => {
  it('strips non-digits and encodes the text', () => {
    expect(buildWhatsAppUrl('+91 98765-43210', 'Hi & bye')).toBe(
      'https://wa.me/919876543210?text=Hi%20%26%20bye',
    );
  });

  it('throws when fewer than 8 digits remain', () => {
    expect(() => buildWhatsAppUrl('12-34', 'x')).toThrow(RangeError);
  });
});

describe('buildOrderMessage', () => {
  const message = buildOrderMessage({
    orderId: 42,
    items: [
      { name: 'Kajal', size: 'Std', colour: 'Black', qty: 2, unitPricePaise: 19950 },
      { name: 'Kurti', size: 'M', colour: 'Red', qty: 1, unitPricePaise: 129900 },
    ],
    totalPaise: 169800,
    address: '12 MG Road',
    customerName: 'Asha',
    customerPhone: '9876543210',
  });

  it('includes the order id, every line item, total, address and payment mode', () => {
    expect(message).toContain('Order ID: #42');
    expect(message).toContain('Kajal (Std / Black) x 2 @ ₹199.50');
    expect(message).toContain('Kurti (M / Red) x 1 @ ₹1,299');
    expect(message).toContain('Total: ₹1,698');
    expect(message).toContain('12 MG Road');
    expect(message).toContain('Cash / UPI on Delivery');
  });
});

describe('buildEnquiryMessage', () => {
  it('names the service and business', () => {
    const text = buildEnquiryMessage({
      serviceName: 'Bridal Makeup',
      businessName: 'Glow Parlour',
    });
    expect(text).toContain('Bridal Makeup');
    expect(text).toContain('Glow Parlour');
  });
});
