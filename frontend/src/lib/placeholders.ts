/** Founder headshots — WebP in public/images/. Replace sources in scripts/sources/ and run npm run optimize:founder-images */

export const FOUNDERS = [
  {
    name: 'Ahmed Raza',
    title: 'Founder & CEO',
    vision:
      'Electric mobility should not be a luxury in Pakistan — it should be reliable, affordable, and available in every major city.',
    bio: 'Ahmed founded Crown Ev to make world-class EVs accessible nationwide. He leads product strategy, branch expansion, and the long-term vision for clean transport.',
    image: '/images/about-founder-ahmed.webp',
  },
  {
    name: 'Bilal Khan',
    title: 'Co-Founder & COO',
    vision:
      'Every rider deserves honest service, genuine parts, and a branch they can trust — that is the Crown Ev promise on the ground.',
    bio: 'Bilal builds the operations behind the brand: service quality, supplier partnerships, and consistent standards across every showroom.',
    image: '/images/about-founder-bilal.webp',
  },
] as const;

export const COMPANY_STORY = `Crown Ev Bikes was born from a simple belief: Pakistan deserves world-class electric mobility without compromise. From our first showroom in Karachi to a growing network of branches nationwide, we combine premium EV engineering with local service expertise.

Every Crown Ev bike is selected for Pakistani roads: heat-resistant batteries, robust suspension, and parts availability through our branch network. Whether you commute daily or run a delivery business, we are building the infrastructure to keep you moving cleanly and affordably.`;

export const CONTACT_EMAIL = 'contact@crownevcenter.com';

export const FOOTER_CONTACT = {
  email: CONTACT_EMAIL,
  phone: '+92 300 1234567',
  whatsapp: '+923001234567',
  address: 'Head Office, Hadi Ev Center Bwn road Chishtian',
  whatsappMessage: "Hi Crown Ev! I'd like to know more about your electric bikes.",
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
