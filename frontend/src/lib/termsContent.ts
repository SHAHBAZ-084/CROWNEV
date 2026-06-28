import type { LegalSection } from './legalTypes';
import { CONTACT_EMAIL } from './placeholders';

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: 'About Crown Ev',
    items: [
      'Crown Ev is a trusted dealer of Crown electric bikes and mobility products in Pakistan. We sell, deliver, and service these products through our branch network and online store.',
      'We are a dealer and retailer, not the manufacturer. The bikes we offer are produced by the brand, and we provide sales, delivery, genuine parts, and after sales service for them.',
      'By using our website or buying from our branches, you agree to these Terms and Conditions.',
    ],
  },
  {
    title: 'Eligibility and Accounts',
    items: [
      'You must be at least 18 years old to create an account, place orders, or book services on Crown Ev.',
      'Registration requires a valid email address and accurate personal information. You are responsible for keeping your login details secure.',
      'One person may not maintain multiple accounts for fraudulent purposes. Crown Ev may suspend or close accounts that violate these terms.',
      'Business customers should provide valid business details when placing bulk or branch specific orders.',
    ],
  },
  {
    title: 'Products and Pricing',
    items: [
      'All electric bikes, parts, and accessories are subject to availability at the selected branch.',
      'Prices are listed in Pakistani Rupees and may change without prior notice. The price confirmed at checkout is the price you pay.',
      'Product images and specifications are provided for reference. Minor variations in color or finish may occur between batches from the manufacturer.',
      'Promotional offers, discounts, and sale prices apply only during the stated promotion period and cannot be combined unless we state otherwise.',
    ],
  },
  {
    title: 'Orders and Payment',
    items: [
      'Placing an order is an offer to purchase. Crown Ev reserves the right to accept or decline any order.',
      'We accept cash on delivery and bank transfer. Bank transfer orders require payment verification before dispatch.',
      'Orders with unverified or failed payments may be cancelled after the stated verification window.',
      'Once your order is confirmed, our team contacts you to arrange the next steps for delivery or pickup.',
    ],
  },
  {
    title: 'Delivery and Shipping',
    items: [
      'There is no automated online order tracking. Instead, our dealer team at your selected branch contacts you directly to confirm your order and guide you through the full shipping process.',
      'You can choose to receive your bike through a trusted cargo service to your city, or to collect it yourself from the branch.',
      'For cargo delivery, the branch confirms the applicable shipping charges for your location before dispatch, based on distance and the courier used. These charges are in addition to the product price.',
      'Your order is shipped after payment is verified. Our team stays in contact and provides complete assistance until your bike reaches you.',
      'Delivery timelines depend on your location, the selected branch, and product availability, and are estimates rather than guarantees.',
      'Please provide accurate address and contact details. If delivery fails due to incorrect details or unavailability, additional charges may apply for a repeat attempt.',
    ],
  },
  {
    title: 'Warranty and Returns',
    items: [
      'Crown electric bikes come with the manufacturer warranty stated on the product page and your purchase receipt.',
      'As an authorized dealer, we help you process warranty claims at our branches with valid proof of purchase.',
      'Returns and exchanges are subject to branch policy, product condition, and the consumer protection laws of Pakistan.',
      'Damage caused by misuse, unauthorized modifications, or failure to follow maintenance guidelines is not covered under warranty.',
    ],
  },
  {
    title: 'Service Bookings',
    items: [
      'Registered customers may book maintenance, repair, or installation services at any active Crown Ev branch.',
      'Appointment times are estimates. Branches may reschedule due to workload, parts availability, or unforeseen circumstances.',
      'Cancellation or rescheduling should be requested at least 24 hours before the appointment when possible.',
      'Service fees quoted at booking are based on the selected service. Additional charges may apply only if extra work is required and approved by you.',
    ],
  },
  {
    title: 'Branch Sales and Showroom',
    items: [
      'In branch purchases are governed by the same terms as online orders unless your receipt states otherwise.',
      'Each branch operates under Crown Ev standards and may offer branch specific promotions approved by the head office.',
      'Stock shown at a branch reflects current availability where systems are connected. Any difference is resolved at the point of sale.',
    ],
  },
  {
    title: 'Privacy and Data Use',
    items: [
      'We collect and process the personal data needed to fulfill orders, bookings, and customer support, as described in our Privacy Policy.',
      'Order history, payment records, and service logs may be kept for accounting, warranty, and legal compliance purposes.',
      'We do not sell your personal information to third parties. Data may be shared with payment processors and delivery partners only as needed to complete your order.',
    ],
  },
  {
    title: 'Limitation of Liability',
    items: [
      'Crown Ev is not liable for indirect, incidental, or consequential damages arising from the use of products or services bought through us.',
      'Our total liability for any claim related to a product or service is limited to the amount you paid for that product or service.',
      'We are not responsible for delays caused by events outside our reasonable control, including weather, strikes, or supply chain disruptions.',
    ],
  },
  {
    title: 'Changes and Governing Law',
    items: [
      'Crown Ev may update these Terms and Conditions at any time. Continued use of our website or services after changes means you accept them.',
      'Material changes will be posted on this page with an updated effective date.',
      'These terms are governed by the laws of Pakistan, and disputes are subject to the jurisdiction of the competent courts in Pakistan unless the law requires otherwise.',
      `For questions about these terms, contact us at ${CONTACT_EMAIL} or visit any Crown Ev branch.`,
    ],
  },
];
