import { prisma } from '../../config/database.js';

export async function getLandingData() {
  const [testimonials, branches, categories, brands, featuredProducts, stats] = await Promise.all([
    prisma.testimonial.findMany({
      where: { status: 'APPROVED', isActive: true },
      orderBy: { sortOrder: 'asc' },
      take: 6,
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
