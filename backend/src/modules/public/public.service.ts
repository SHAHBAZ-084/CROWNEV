import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/helpers.js';
export async function getLandingData() {
  const [testimonials, branches, categories, brands, featuredProducts, stats] = await Promise.all([
    prisma.testimonial.findMany({
      where: { status: 'APPROVED', isActive: true },
      orderBy: { sortOrder: 'asc' },
      take: 12,
    }),
    prisma.branch.findMany({
      where: {
        isActive: true,
        NOT: { name: { startsWith: 'Accounting Test' } },
      },
      select: {
        id: true,
        name: true,
        location: true,
        phone: true,
        whatsapp: true,
        description: true,
        imageUrl: true,
        latitude: true,
        longitude: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.productCategory.findMany({
      where: { isActive: true, parentId: null },
      include: { children: true },
      take: 10,
    }),
    prisma.brand.findMany({ where: { isActive: true }, take: 12 }),
    prisma.product.findMany({
      where: { isActive: true, type: 'BIKE' },
      include: { images: { where: { isPrimary: true }, take: 1 }, brand: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    Promise.all([
      prisma.branch.count({
        where: { isActive: true, NOT: { name: { startsWith: 'Accounting Test' } } },
      }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.order.count({ where: { status: 'CONFIRMED' } }),
    ]),
  ]);

  return {
    testimonials,
    branches,
    categories,
    brands,
    featuredProducts,
    stats: {
      branches: stats[0],
      products: stats[1],
      ordersDelivered: stats[2],
    },
  };
}

export async function getContentPage(slug: string) {
  const page = await prisma.contentPage.findUnique({ where: { slug } });
  if (!page) return null;
  return page;
}

export async function listContentPages() {
  return prisma.contentPage.findMany({
    select: { slug: true, title: true, updatedAt: true },
    orderBy: { slug: 'asc' },
  });
}

export async function upsertContentPage(slug: string, title: string, content: string) {
  return prisma.contentPage.upsert({
    where: { slug },
    create: { slug, title, content },
    update: { title, content },
  });
}

const FOUNDERS_PAGE_SLUG = 'about-founders';

export type FounderProfile = {
  name: string;
  title: string;
  vision: string;
  bio: string;
  image: string;
};

export type FoundersSection = {
  eyebrow: string;
  title: string;
  subtitle: string;
  founders: FounderProfile[];
};

export const DEFAULT_FOUNDERS_SECTION: FoundersSection = {
  eyebrow: 'Our founders',
  title: "Driving Pakistan's electric future",
  subtitle: "The team behind Crown Ev's mission to bring premium electric mobility nationwide.",
  founders: [
    {
      name: 'Mohsin Ashraf Ch',
      title: 'Founder',
      vision:
        'Electric mobility should not be a luxury in Pakistan. It should be reliable, affordable, and available in every major city.',
      bio: 'Mohsin established Crown Ev as a trusted dealer of Crown electric bikes in Pakistan. He leads sourcing, branch expansion, and the long term vision for accessible clean transport, from the online shop to every showroom floor.',
      image: '/images/about-founder-mohsin.webp',
    },
    {
      name: 'Sufi Muhammad Saleemullah',
      title: 'Co-Founder',
      vision:
        'Every rider deserves honest service, genuine parts, and a branch they can trust. That is the Crown Ev promise on the ground.',
      bio: 'He provides leadership and management support across the Crown Ev network, guiding branch teams, strengthening customer standards, and helping the brand grow with the same trust and quality riders expect from Crown electric mobility.',
      image: '/images/about-founder-sufi.webp',
    },
  ],
};

function parseFoundersSection(content: string): FoundersSection | null {
  try {
    const parsed = JSON.parse(content) as Partial<FoundersSection>;
    if (!parsed || !Array.isArray(parsed.founders) || parsed.founders.length === 0) return null;
    const founders = parsed.founders.map((f) => ({
      name: String(f.name ?? '').trim(),
      title: String(f.title ?? '').trim(),
      vision: String(f.vision ?? '').trim(),
      bio: String(f.bio ?? '').trim(),
      image: String(f.image ?? '').trim(),
    }));
    if (founders.some((f) => !f.name || !f.title || !f.vision || !f.bio || !f.image)) return null;
    return {
      eyebrow: String(parsed.eyebrow ?? DEFAULT_FOUNDERS_SECTION.eyebrow).trim(),
      title: String(parsed.title ?? DEFAULT_FOUNDERS_SECTION.title).trim(),
      subtitle: String(parsed.subtitle ?? DEFAULT_FOUNDERS_SECTION.subtitle).trim(),
      founders,
    };
  } catch {
    return null;
  }
}

export async function getFoundersSection(): Promise<FoundersSection> {
  const page = await prisma.contentPage.findUnique({ where: { slug: FOUNDERS_PAGE_SLUG } });
  if (!page) return DEFAULT_FOUNDERS_SECTION;
  return parseFoundersSection(page.content) ?? DEFAULT_FOUNDERS_SECTION;
}

export async function upsertFoundersSection(section: FoundersSection) {
  const content = JSON.stringify(section);
  await upsertContentPage(FOUNDERS_PAGE_SLUG, 'About Founders', content);
  return section;
}

const FEATURES_PAGE_SLUG = 'home-features';

export type FeatureIconId = 'zap' | 'battery' | 'gauge' | 'shield';

export type FeatureCard = {
  icon: FeatureIconId;
  title: string;
  desc: string;
  stat: string;
  statLabel: string;
};

export type FeatureSection = {
  eyebrow: string;
  title: string;
  subtitle: string;
  features: FeatureCard[];
};

export const DEFAULT_FEATURE_SECTION: FeatureSection = {
  eyebrow: 'Why Crown Ev',
  title: 'Built for Pakistan',
  subtitle:
    'Engineered for local roads, climate, and daily commuting needs: premium EV performance you can rely on every day.',
  features: [
    {
      icon: 'zap',
      title: 'Powerful Motor',
      desc: 'High-torque BLDC motors for smooth acceleration on Pakistani roads.',
      stat: '1000W',
      statLabel: 'BLDC motor',
    },
    {
      icon: 'battery',
      title: 'Long Range Battery',
      desc: 'Lithium-ion packs built for daily commutes and weekend rides.',
      stat: '80 km',
      statLabel: 'per charge',
    },
    {
      icon: 'gauge',
      title: 'Smart Dashboard',
      desc: 'Digital display with speed, battery level, and ride mode indicators.',
      stat: 'Live',
      statLabel: 'telemetry',
    },
    {
      icon: 'shield',
      title: 'CBS Braking',
      desc: 'Combined braking system for safer stops in all weather conditions.',
      stat: 'All-weather',
      statLabel: 'safety',
    },
  ],
};

const VALID_FEATURE_ICONS = new Set<FeatureIconId>(['zap', 'battery', 'gauge', 'shield']);

function parseFeatureSection(content: string): FeatureSection | null {
  try {
    const parsed = JSON.parse(content) as Partial<FeatureSection>;
    if (!parsed || !Array.isArray(parsed.features) || parsed.features.length === 0) return null;
    const features = parsed.features.map((f) => {
      const icon = String(f.icon ?? 'zap').trim() as FeatureIconId;
      return {
        icon: VALID_FEATURE_ICONS.has(icon) ? icon : 'zap',
        title: String(f.title ?? '').trim(),
        desc: String(f.desc ?? '').trim(),
        stat: String(f.stat ?? '').trim(),
        statLabel: String(f.statLabel ?? '').trim(),
      };
    });
    if (features.some((f) => !f.title || !f.desc || !f.stat || !f.statLabel)) return null;
    return {
      eyebrow: String(parsed.eyebrow ?? DEFAULT_FEATURE_SECTION.eyebrow).trim(),
      title: String(parsed.title ?? DEFAULT_FEATURE_SECTION.title).trim(),
      subtitle: String(parsed.subtitle ?? DEFAULT_FEATURE_SECTION.subtitle).trim(),
      features,
    };
  } catch {
    return null;
  }
}

export async function getFeatureSection(): Promise<FeatureSection> {
  const page = await prisma.contentPage.findUnique({ where: { slug: FEATURES_PAGE_SLUG } });
  if (!page) return DEFAULT_FEATURE_SECTION;
  return parseFeatureSection(page.content) ?? DEFAULT_FEATURE_SECTION;
}

export async function upsertFeatureSection(section: FeatureSection) {
  const content = JSON.stringify(section);
  await upsertContentPage(FEATURES_PAGE_SLUG, 'Home Feature Cards', content);
  return section;
}

export type FooterContactSection = {
  email: string;
  phones: string[];
  address: string;
};

export const DEFAULT_FOOTER_CONTACT: FooterContactSection = {
  email: 'contact@crownevcenter.com',
  phones: ['0300 698 3345', '0300 449 4545'],
  address: 'Head Office, Hadi Ev Center Bwn road Chishtian',
};

const FOOTER_PAGE_SLUG = 'footer-contact';

function parseFooterContact(content: string): FooterContactSection | null {
  try {
    const parsed = JSON.parse(content) as Partial<FooterContactSection>;
    if (!parsed || typeof parsed.email !== 'string' || !Array.isArray(parsed.phones) || typeof parsed.address !== 'string') {
      return null;
    }
    return {
      email: parsed.email.trim(),
      phones: parsed.phones.map((p) => String(p).trim()).filter(Boolean),
      address: parsed.address.trim(),
    };
  } catch {
    return null;
  }
}

export async function getFooterContact(): Promise<FooterContactSection> {
  const page = await prisma.contentPage.findUnique({ where: { slug: FOOTER_PAGE_SLUG } });
  if (!page) return DEFAULT_FOOTER_CONTACT;
  return parseFooterContact(page.content) ?? DEFAULT_FOOTER_CONTACT;
}

export async function upsertFooterContact(section: FooterContactSection) {
  const content = JSON.stringify(section);
  await upsertContentPage(FOOTER_PAGE_SLUG, 'Footer Contact Section', content);
  return section;
}

const PARTS_FULFILLMENT_SLUG = 'parts-fulfillment-branch';

export type PartsFulfillmentSetting = {
  branchId: number | null;
};

export async function getPartsFulfillmentBranch(): Promise<PartsFulfillmentSetting> {
  const page = await prisma.contentPage.findUnique({ where: { slug: PARTS_FULFILLMENT_SLUG } });
  if (!page) return { branchId: null };
  try {
    const parsed = JSON.parse(page.content) as { branchId?: number };
    return { branchId: typeof parsed.branchId === 'number' ? parsed.branchId : null };
  } catch {
    return { branchId: null };
  }
}

export async function setPartsFulfillmentBranch(branchId: number | null): Promise<PartsFulfillmentSetting> {
  if (branchId != null) {
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new AppError(400, 'Selected branch does not exist');
  }
  const content = JSON.stringify({ branchId });
  await upsertContentPage(PARTS_FULFILLMENT_SLUG, 'Parts Fulfillment Branch', content);
  return { branchId };
}

const HOME_HERO_SLUG = 'home-hero';

export type HomeHeroSection = {
  eyebrow: string;
  headline: string;
  subtext: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
};

const DEFAULT_HOME_HERO_SECTION: HomeHeroSection = {
  eyebrow: 'Electric Mobility · Pakistan',
  headline: 'Ride the Future with Crown Ev',
  subtext: 'Premium electric bikes and parts across multiple branches. Shop online, book service, and track your order.',
  primaryCtaLabel: 'Browse Shop',
  secondaryCtaLabel: 'Book Service',
};

function parseHomeHeroSection(content: string): HomeHeroSection | null {
  try {
    const parsed = JSON.parse(content) as Partial<HomeHeroSection>;
    if (!parsed) return null;
    return {
      eyebrow: String(parsed.eyebrow ?? DEFAULT_HOME_HERO_SECTION.eyebrow).trim(),
      headline: String(parsed.headline ?? DEFAULT_HOME_HERO_SECTION.headline).trim(),
      subtext: String(parsed.subtext ?? DEFAULT_HOME_HERO_SECTION.subtext).trim(),
      primaryCtaLabel: String(parsed.primaryCtaLabel ?? DEFAULT_HOME_HERO_SECTION.primaryCtaLabel).trim(),
      secondaryCtaLabel: String(parsed.secondaryCtaLabel ?? DEFAULT_HOME_HERO_SECTION.secondaryCtaLabel).trim(),
    };
  } catch {
    return null;
  }
}

export async function getHomeHeroSection(): Promise<HomeHeroSection> {
  const page = await prisma.contentPage.findUnique({ where: { slug: HOME_HERO_SLUG } });
  if (!page) return DEFAULT_HOME_HERO_SECTION;
  return parseHomeHeroSection(page.content) ?? DEFAULT_HOME_HERO_SECTION;
}

export async function upsertHomeHeroSection(section: HomeHeroSection) {
  const content = JSON.stringify(section);
  await upsertContentPage(HOME_HERO_SLUG, 'Home Hero', content);
  return section;
}

const ABOUT_HERO_SLUG = 'about-hero';

export type AboutHeroSection = {
  eyebrow: string;
  title: string;
  subtitle: string;
  visionEyebrow: string;
  visionTitle: string;
  visionBody: string;
};

const DEFAULT_ABOUT_HERO_SECTION: AboutHeroSection = {
  eyebrow: 'Electric mobility for Pakistan',
  title: 'About Crown Ev Bikes',
  subtitle: "Crown Ev was founded on a simple belief: Pakistan deserves premium electric mobility without compromise.",
  visionEyebrow: 'Our vision',
  visionTitle: 'Built for Pakistani roads',
  visionBody: "As a trusted dealer of Crown electric bikes, we bring quality models to riders through a growing network of branches, backed by local sales and service expertise you can rely on.",
};

function parseAboutHeroSection(content: string): AboutHeroSection | null {
  try {
    const parsed = JSON.parse(content) as Partial<AboutHeroSection>;
    if (!parsed) return null;
    return {
      eyebrow: String(parsed.eyebrow ?? DEFAULT_ABOUT_HERO_SECTION.eyebrow).trim(),
      title: String(parsed.title ?? DEFAULT_ABOUT_HERO_SECTION.title).trim(),
      subtitle: String(parsed.subtitle ?? DEFAULT_ABOUT_HERO_SECTION.subtitle).trim(),
      visionEyebrow: String(parsed.visionEyebrow ?? DEFAULT_ABOUT_HERO_SECTION.visionEyebrow).trim(),
      visionTitle: String(parsed.visionTitle ?? DEFAULT_ABOUT_HERO_SECTION.visionTitle).trim(),
      visionBody: String(parsed.visionBody ?? DEFAULT_ABOUT_HERO_SECTION.visionBody).trim(),
    };
  } catch {
    return null;
  }
}

export async function getAboutHeroSection(): Promise<AboutHeroSection> {
  const page = await prisma.contentPage.findUnique({ where: { slug: ABOUT_HERO_SLUG } });
  if (!page) return DEFAULT_ABOUT_HERO_SECTION;
  return parseAboutHeroSection(page.content) ?? DEFAULT_ABOUT_HERO_SECTION;
}

export async function upsertAboutHeroSection(section: AboutHeroSection) {
  const content = JSON.stringify(section);
  await upsertContentPage(ABOUT_HERO_SLUG, 'About Hero', content);
  return section;
}

const TERMS_SLUG = 'terms-and-conditions';
const PRIVACY_SLUG = 'privacy-policy';
const FAQ_SLUG = 'faq';

export type LegalSection = { title: string; items: string[] };
export type FaqItem = { question: string; answer: string };

function parseLegalSections(content: string, fallback: LegalSection[]): LegalSection[] {
  try {
    const parsed = JSON.parse(content) as LegalSection[];
    if (!Array.isArray(parsed)) return fallback;
    return parsed
      .filter((s) => s && typeof s.title === 'string')
      .map((s) => ({
        title: s.title.trim(),
        items: Array.isArray(s.items) ? s.items.map(String).map(item => item.trim()).filter(Boolean) : [],
      }));
  } catch {
    return fallback;
  }
}

function parseFaqItems(content: string, fallback: FaqItem[]): FaqItem[] {
  try {
    const parsed = JSON.parse(content) as FaqItem[];
    if (!Array.isArray(parsed)) return fallback;
    return parsed
      .filter((f) => f && typeof f.question === 'string')
      .map((f) => ({
        question: f.question.trim(),
        answer: String(f.answer ?? '').trim(),
      }));
  } catch {
    return fallback;
  }
}

// --- Terms ---
export async function getTermsSection(): Promise<LegalSection[]> {
  const page = await prisma.contentPage.findUnique({ where: { slug: TERMS_SLUG } });
  if (!page) return DEFAULT_TERMS_SECTIONS;
  return parseLegalSections(page.content, DEFAULT_TERMS_SECTIONS);
}

export async function upsertTermsSection(sections: LegalSection[]) {
  await upsertContentPage(TERMS_SLUG, 'Terms and Conditions', JSON.stringify(sections));
  return sections;
}

// --- Privacy ---
export async function getPrivacySection(): Promise<LegalSection[]> {
  const page = await prisma.contentPage.findUnique({ where: { slug: PRIVACY_SLUG } });
  if (!page) return DEFAULT_PRIVACY_SECTIONS;
  return parseLegalSections(page.content, DEFAULT_PRIVACY_SECTIONS);
}

export async function upsertPrivacySection(sections: LegalSection[]) {
  await upsertContentPage(PRIVACY_SLUG, 'Privacy Policy', JSON.stringify(sections));
  return sections;
}

// --- FAQ ---
export async function getFaqSection(): Promise<FaqItem[]> {
  const page = await prisma.contentPage.findUnique({ where: { slug: FAQ_SLUG } });
  if (!page) return DEFAULT_FAQ_ITEMS;
  return parseFaqItems(page.content, DEFAULT_FAQ_ITEMS);
}

export async function upsertFaqSection(items: FaqItem[]) {
  await upsertContentPage(FAQ_SLUG, 'FAQ', JSON.stringify(items));
  return items;
}

export const DEFAULT_TERMS_SECTIONS: LegalSection[] = [
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
      'For questions about these terms, contact us at contact@crownevcenter.com or visit any Crown Ev branch.',
    ],
  },
];

export const DEFAULT_PRIVACY_SECTIONS: LegalSection[] = [
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
      'To exercise these rights, contact us at contact@crownevcenter.com and we will respond within a reasonable timeframe.',
    ],
  },
  {
    title: "Children's Privacy",
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
      'For privacy questions or requests, email contact@crownevcenter.com or visit any Crown Ev branch.',
    ],
  },
];

export const DEFAULT_FAQ_ITEMS: FaqItem[] = [
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
