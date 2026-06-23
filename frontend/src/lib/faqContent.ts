import type { LegalSection } from './legalTypes';
import { CONTACT_EMAIL } from './placeholders';

export const FAQ_SECTIONS: LegalSection[] = [
  {
    title: 'What payment methods do you accept?',
    items: [
      'We accept cash on delivery and bank transfer. Bank transfer orders require payment verification before your order is dispatched. Payment details are shown at checkout.',
    ],
  },
  {
    title: 'How do I track my order?',
    items: [
      'Go to the Track Order page and enter your tracking ID (e.g. CE-XXXXX-XXXX). No login is required. You will see your order status, total amount, branch, and placement date.',
    ],
  },
  {
    title: 'Can I book a service without buying a bike?',
    items: [
      'Yes. Registered customers can book maintenance, repair, or installation at any active Crown Ev branch. Sign in, choose your branch and service, then pick a date and time.',
    ],
  },
  {
    title: 'What is the warranty on electric bikes?',
    items: [
      'All Crown Ev electric bikes include a manufacturer warranty as stated on the product page and your purchase receipt. Warranty claims must be submitted through an authorized branch with proof of purchase.',
    ],
  },
  {
    title: 'Do you deliver across Pakistan?',
    items: [
      'Yes. We fulfill orders through our branch network nationwide. Select your preferred branch at checkout. Delivery timelines depend on your location and product availability.',
    ],
  },
  {
    title: 'How do I create an account?',
    items: [
      'Click Register in the header, enter your details, and verify your email with the OTP we send. Your account is created only after email verification is complete.',
    ],
  },
  {
    title: 'Can I cancel or change my order?',
    items: [
      'Contact us or your assigned branch as soon as possible if you need to cancel or modify an order. Changes may not be possible once payment is verified or the order has been dispatched.',
    ],
  },
  {
    title: 'How do branch POS purchases work?',
    items: [
      'You can buy bikes, parts, and accessories directly at any Crown Ev branch. In-branch sales follow the same warranty and return policies as online orders unless otherwise stated on your receipt.',
    ],
  },
  {
    title: 'What if my bike needs repair under warranty?',
    items: [
      'Book a service at your nearest branch or visit in person with your proof of purchase. Our technicians will inspect the bike and process valid warranty claims according to manufacturer guidelines.',
    ],
  },
  {
    title: 'How can I contact support?',
    items: [
      `Email ${CONTACT_EMAIL}, call or WhatsApp your nearest branch, or use the Contact page on our website. For order-specific help, include your tracking ID or order reference.`,
    ],
  },
];
