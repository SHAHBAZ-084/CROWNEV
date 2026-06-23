/** PLACEHOLDER. swap for real founder photos before production launch */

export const FOUNDERS = [
  {
    name: 'Ahmed Raza',
    title: 'Founder & CEO',
    bio: 'Ahmed founded Crown Eve with a vision to make electric mobility accessible across Pakistan. He leads product strategy and branch expansion.',
    // PLACEHOLDER headshot
    image: 'https://i.pravatar.cc/400?img=12',
  },
  {
    name: 'Bilal Khan',
    title: 'Co-Founder & COO',
    bio: 'Bilal oversees operations, service quality, and supplier partnerships. He ensures every branch delivers a consistent Crown Eve experience.',
    // PLACEHOLDER headshot
    image: 'https://i.pravatar.cc/400?img=33',
  },
] as const;

export const COMPANY_STORY = `Crown Eve Bikes was born from a simple belief: Pakistan deserves world-class electric mobility without compromise. From our first showroom in Karachi to a growing network of branches nationwide, we combine premium EV engineering with local service expertise.

Every Crown Eve bike is selected for Pakistani roads: heat-resistant batteries, robust suspension, and parts availability through our branch network. Whether you commute daily or run a delivery business, we are building the infrastructure to keep you moving cleanly and affordably.`;

export const FOOTER_CONTACT = {
  email: 'info@crowneve.pk',
  phone: '+92 300 1234567',
  whatsapp: '+923001234567',
  address: 'Head Office, F-10 Markaz, Islamabad, Pakistan',
  whatsappMessage: "Hi Crown Eve! I'd like to know more about your electric bikes.",
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
  title: 'Crown Eve Electric Bikes',
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
  mapBackground: '/images/pakistan-map-bg.png',
} as const;
