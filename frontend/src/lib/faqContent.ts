/** Home page FAQ. Crown Ev website and services (landing section only). */
export type HomeFaqItem = {
  question: string;
  answer: string;
};

export type FaqItem = HomeFaqItem;


export const HOME_FAQ_ITEMS: HomeFaqItem[] = [
  {
    question: 'What is Crown Ev and what can I do on this website?',
    answer:
      'Crown Ev is a trusted dealer of Crown electric bikes and mobility products in Pakistan. On crownevcenter.com you can browse and buy electric bikes and genuine parts, book a service at any branch, and find showroom locations near you, all in one place.',
  },
  {
    question: 'How do I shop for bikes and parts online?',
    answer:
      'Visit the Shop page to explore electric bikes and parts. Add items to your cart, choose your nearest branch at checkout, and place your order using cash on delivery or bank transfer. Prices are shown in PKR and the amount you see at checkout is the amount you pay.',
  },
  {
    question: 'Can I visit a branch for a test ride or walk in purchase?',
    answer:
      'Yes. Every Crown Ev branch offers test rides, in person sales, servicing, and genuine parts. Use the Our Branches section on the homepage or the Contact page to find addresses, phone numbers, WhatsApp, and directions to your nearest showroom.',
  },
  {
    question: 'How do I book a service appointment?',
    answer:
      'Go to Book Service, sign in to your account, pick a branch, and choose the service you need. Appointment times are estimates, so your branch may contact you to confirm or reschedule. Please cancel or reschedule at least 24 hours in advance when possible.',
  },
  {
    question: 'How does delivery and shipping work after I order?',
    answer:
      'After you place an order, our dealer team at your selected branch gets in touch with you directly to confirm your order and guide you through the full shipping process. They stay in contact and provide complete assistance until your bike reaches you, so you are never left guessing.',
  },
  {
    question: 'What are the shipping options and charges?',
    answer:
      'You can choose to receive your bike through a trusted cargo service to your city, or collect it yourself from the branch. For cargo delivery, the branch confirms the shipping charges for your location before dispatch, based on distance and the courier used. Your order is shipped once payment is verified.',
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept cash on delivery and bank transfer. Bank transfer orders are held until your payment is verified, after which the order is confirmed and our team arranges shipping with you. Promotional offers apply only during the stated period.',
  },
  {
    question: 'Are the Crown bikes you sell built for Pakistani roads and climate?',
    answer:
      'Yes. The Crown electric bikes we offer are chosen for local conditions, with heat resistant lithium ion batteries, robust suspension, and parts stocked through our branch network. Every bike in our catalog is fully electric with zero tailpipe emissions. Full specifications and range figures are shown on each product page.',
  },
  {
    question: 'What warranty and after sales support do you offer?',
    answer:
      'Crown electric bikes come with the manufacturer warranty stated on the product page and your purchase receipt. As an authorized dealer, we help you process warranty claims at our branches with proof of purchase. Electric bikes need less routine maintenance than petrol bikes, and you can book periodic checks at any branch for brakes, tyres, battery health, and safety inspections.',
  },
];
