/** Founder headshots — WebP in public/images/. Replace sources in scripts/sources/ and run npm run optimize:founder-images */

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

/** @deprecated Use DEFAULT_FOUNDERS_SECTION.founders or API data */
export const FOUNDERS = DEFAULT_FOUNDERS_SECTION.founders;

export const FEATURE_ICON_IDS = ['zap', 'battery', 'gauge', 'shield'] as const;
export type FeatureIconId = (typeof FEATURE_ICON_IDS)[number];

export const FEATURE_ICON_OPTIONS: { id: FeatureIconId; label: string }[] = [
  { id: 'zap', label: 'Lightning — motor / power' },
  { id: 'battery', label: 'Battery — range / charging' },
  { id: 'gauge', label: 'Gauge — dashboard / telemetry' },
  { id: 'shield', label: 'Shield — safety / braking' },
];

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

function parseFeatureIconId(icon: string): FeatureIconId {
  return (FEATURE_ICON_IDS as readonly string[]).includes(icon) ? (icon as FeatureIconId) : 'zap';
}

export function normalizeFeatureSection(section: {
  eyebrow: string;
  title: string;
  subtitle: string;
  features: { icon: string; title: string; desc: string; stat: string; statLabel: string }[];
}): FeatureSection {
  return {
    eyebrow: section.eyebrow,
    title: section.title,
    subtitle: section.subtitle,
    features: section.features.map((feature) => ({
      ...feature,
      icon: parseFeatureIconId(feature.icon),
    })),
  };
}

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

export const COMPANY_STORY = `Crown Ev was founded on a simple belief: Pakistan deserves premium electric mobility without compromise. As a trusted dealer of Crown electric bikes, we bring quality models to riders through a growing network of branches, backed by local sales and service expertise you can rely on.

The Crown electric bikes we offer are well suited to Pakistani roads, with heat resistant batteries, robust suspension, and genuine parts stocked through our branch network. Whether you commute daily or run a delivery business, we are building the infrastructure to keep you moving cleanly and affordably.`;

export const CONTACT_EMAIL = 'contact@crownevcenter.com';

/** Head-office / official contact lines (footer, contact page, WhatsApp). */
export const OFFICIAL_PHONES = ['0300 698 3345', '0300 449 4545'] as const;

export function toTelHref(phone: string) {
  return `tel:${phone.replace(/\s/g, '')}`;
}

export function toWhatsAppDigits(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return `92${digits.slice(1)}`;
  if (digits.startsWith('92')) return digits;
  return digits;
}

export const WHATSAPP_PREFILL_MESSAGE =
  "Hi Crown Ev! I'd like to know more about your electric bikes." as const;

/** Primary WhatsApp line for site-wide chat links (floating button, nav). */
export const OFFICIAL_WHATSAPP_PHONE = OFFICIAL_PHONES[0];

export function toWhatsAppHref(
  phone: string = OFFICIAL_WHATSAPP_PHONE,
  message: string = WHATSAPP_PREFILL_MESSAGE,
) {
  return `https://wa.me/${toWhatsAppDigits(phone)}?text=${encodeURIComponent(message)}`;
}

export const FOOTER_CONTACT = {
  email: CONTACT_EMAIL,
  phones: OFFICIAL_PHONES,
  phone: OFFICIAL_PHONES[0],
  whatsapp: toWhatsAppDigits(OFFICIAL_WHATSAPP_PHONE),
  address: 'Head Office, Hadi Ev Center Bwn road Chishtian',
  whatsappMessage: WHATSAPP_PREFILL_MESSAGE,
} as const;

/** About page brand story video — portrait 9:16 */
export const ABOUT_VIDEO = {
  mp4: '/videos/about-story.mp4',
  mp4Mobile: '/videos/about-story-mobile.mp4',
  poster: '/videos/about-story-poster.webp',
  posterMobile: '/videos/about-story-poster-sm.webp',
  aspectRatio: '9 / 16',
  width: 1080,
  height: 1920,
} as const;

/** Homepage hero background video */
export const HOME_HERO_VIDEO = {
  mp4: '/videos/home-hero.mp4',
  mp4Mobile: '/videos/home-hero-mobile.mp4',
  poster: '/videos/home-hero-poster.webp',
  posterMobile: '/videos/home-hero-poster-sm.webp',
} as const;

/** Homepage background video (What Riders Say section) */
export const BIKE_VIDEO_AD = {
  /** Desktop H.264 — ~6 MB, 1280×720 */
  mp4: '/videos/riders-say.mp4',
  /** Mobile H.264 — ~2 MB, 720p */
  mp4Mobile: '/videos/riders-say-mobile.mp4',
  /** WebP poster — instant paint while video loads */
  poster: '/videos/riders-say-poster.webp',
  posterMobile: '/videos/riders-say-poster-sm.webp',
  /** YouTube fallback when local files are unavailable */
  youtubeId: '',
  title: 'Crown Ev Electric Bikes',
  subtitle: 'Ride the future',
} as const;

/** Site logo. replace files at public/images/logo.webp */
export const SITE_LOGO = {
  src: '/images/logo.webp',
  srcLarge: '/images/logo-lg.webp',
  alt: 'Crown Hadi EV Center',
  width: 400,
  height: 267,
} as const;

/** Link previews (WhatsApp, Facebook, iMessage). Regenerate image: npm run generate:og-image */
export const SITE_META = {
  siteName: 'Crown Ev Center',
  title: 'Crown Ev Center | Electric Bikes Pakistan',
  description:
    'Pakistan\'s trusted Crown electric bike dealer. Shop EV bikes and genuine parts online, book service at your branch, and visit showrooms in Chishtian & Bahawalnagar.',
  url: 'https://crownevcenter.com/',
  shareImage: '/images/og-share.jpg',
  shareImageWidth: 1200,
  shareImageHeight: 630,
  locale: 'en_PK',
} as const;

/** Find a Branch section. dotted Pakistan map background */
export const BRANCH_SECTION = {
  mapBackground: '/images/pakistan-map-orange.png',
} as const;

/** PLACEHOLDER branch card photos — replace with real showroom images per branch */
const BRANCH_IMAGE_BY_KEYWORD: { keyword: string; image: string }[] = [
  {
    keyword: 'karachi',
    image:
      'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?auto=format&fit=crop&w=480&h=320&q=80',
  },
  {
    keyword: 'lahore',
    image:
      'https://images.unsplash.com/photo-1558981403-c5f9899a28dc?auto=format&fit=crop&w=480&h=320&q=80',
  },
  {
    keyword: 'islamabad',
    image:
      'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=480&h=320&q=80',
  },
];

const DEFAULT_BRANCH_IMAGE =
  'https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&w=480&h=320&q=80';

export function getBranchCardImage(branch: { name: string; location: string }): string {
  const haystack = `${branch.name} ${branch.location}`.toLowerCase();
  const match = BRANCH_IMAGE_BY_KEYWORD.find(({ keyword }) => haystack.includes(keyword));
  return match?.image ?? DEFAULT_BRANCH_IMAGE;
}

export const BRANCH_HIGHLIGHTS = ['Test rides', 'Sales', 'Service', 'Genuine parts'] as const;
