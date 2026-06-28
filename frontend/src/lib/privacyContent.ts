import type { LegalSection } from './legalTypes';
import { CONTACT_EMAIL } from './placeholders';

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: 'Information We Collect',
    items: [
      'Account details such as your name, email address, phone number, and password when you register.',
      'Order and booking information including delivery address, branch selection, products purchased, and service appointments.',
      'Payment information such as transaction references and the payment method type. We do not store full bank card numbers on our servers.',
      'Technical data including IP address, browser type, device information, and the pages you visit when you use our website.',
      'Communications you send us through contact forms, email, WhatsApp, or in branch inquiries.',
    ],
  },
  {
    title: 'How We Use Your Information',
    items: [
      'To process orders, verify payments, and coordinate delivery and shipping updates directly with you.',
      'To manage service bookings, send appointment confirmations, and coordinate branch service teams.',
      'To maintain your customer account, order history, and warranty records.',
      'To respond to support requests, complaints, and feedback.',
      'To improve our website, services, and branch operations through aggregated usage analysis.',
      'To send service notices such as order status, booking reminders, and policy updates. Marketing messages are sent only where permitted and with your consent where required.',
    ],
  },
  {
    title: 'Legal Basis for Processing',
    items: [
      'Contract performance, meaning the processing needed to fulfill your orders, bookings, and account services.',
      'Legitimate interests, including improving our platform, preventing fraud, and keeping our network secure.',
      'Legal obligation, such as retaining records for tax, accounting, and regulatory compliance in Pakistan.',
      'Consent, where it is required for optional marketing communications or specific data uses.',
    ],
  },
  {
    title: 'Sharing Your Information',
    items: [
      'We share data with the Crown Ev branch involved in fulfilling your order or service appointment.',
      'Payment processors and banks may receive transaction details to verify and complete your payments.',
      'Delivery partners receive the information needed to ship products to your address or branch.',
      'We may disclose information when required by law, court order, or to protect the rights and safety of Crown Ev, our customers, and the public.',
      'We do not sell your personal information to third parties for their own marketing purposes.',
    ],
  },
  {
    title: 'Data Retention',
    items: [
      'Account and order records are kept for as long as your account is active and as needed for warranty, accounting, and legal purposes.',
      'Payment verification records are kept in line with financial record keeping requirements.',
      'Support and communication logs may be kept to resolve disputes and improve service quality.',
      'When data is no longer required, we securely delete or anonymize it where feasible.',
    ],
  },
  {
    title: 'Cookies and Tracking',
    items: [
      'Our website may use essential cookies to keep you signed in and maintain session security.',
      'Analytics cookies help us understand how visitors use the site so we can improve navigation and performance.',
      'You can control cookies through your browser settings. Disabling essential cookies may limit some site features.',
    ],
  },
  {
    title: 'Data Security',
    items: [
      'We use industry standard measures including encrypted connections over HTTPS, access controls, and secure server practices.',
      'Only authorized Crown Ev staff and branch personnel with a business need may access customer data.',
      'No method of transmission or storage is completely secure, so please use a strong password and keep your login details confidential.',
    ],
  },
  {
    title: 'Your Rights',
    items: [
      'You may request access to the personal data we hold about you.',
      'You may ask us to correct inaccurate or incomplete information in your account.',
      'You may request deletion of your account where no legal or contractual obligation requires us to keep the data.',
      'You may withdraw consent for optional marketing communications at any time.',
      `To exercise these rights, contact us at ${CONTACT_EMAIL} and we will respond within a reasonable timeframe.`,
    ],
  },
  {
    title: 'Children\'s Privacy',
    items: [
      'Crown Ev services are not directed at children under 18. We do not knowingly collect personal data from minors without parental consent.',
      'If you believe a child has provided us with personal information, please contact us so we can take appropriate action.',
    ],
  },
  {
    title: 'Changes and Contact',
    items: [
      'We may update this Privacy Policy from time to time. The latest version will always be available on this page.',
      'Material changes will be posted here with an updated effective date. Continued use of our services after changes constitutes acceptance.',
      `For privacy questions or requests, email ${CONTACT_EMAIL} or visit any Crown Ev branch.`,
    ],
  },
];
