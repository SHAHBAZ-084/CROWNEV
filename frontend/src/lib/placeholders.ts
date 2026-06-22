/** PLACEHOLDER — swap for real founder photos before production launch */

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

Every Crown Eve bike is selected for Pakistani roads — heat-resistant batteries, robust suspension, and parts availability through our branch network. Whether you commute daily or run a delivery business, we are building the infrastructure to keep you moving cleanly and affordably.`;

export const FOOTER_CONTACT = {
  email: 'info@crowneve.pk',
  phone: '+92 300 1234567',
  whatsapp: '+923001234567',
  address: 'Head Office, F-10 Markaz, Islamabad, Pakistan',
  whatsappMessage: "Hi Crown Eve! I'd like to know more about your electric bikes.",
} as const;

/** Homepage background video (What Riders Say section) — replace `src` with your own MP4 */
export const BIKE_VIDEO_AD = {
  /** Direct MP4/WebM — default is a preview clip until you add your own ad */
  src: 'https://assets.mixkit.co/videos/preview/mixkit-man-riding-a-motorcycle-on-the-road-41757-large.mp4',
  /** YouTube video ID — used only when `src` is empty */
  youtubeId: '',
  poster:
    'https://images.unsplash.com/photo-1571068316344-75bc76f77861?auto=format&fit=crop&w=1920&q=80',
  title: 'Crown Eve Electric Bikes',
  subtitle: 'Ride the future',
} as const;

/** Site logo — replace file at public/images/logo.png */
export const SITE_LOGO = {
  src: '/images/logo.png',
  alt: 'Crown Hadi EV Center',
} as const;

/** Find a Branch section — dotted Pakistan map background */
export const BRANCH_SECTION = {
  mapBackground: '/images/pakistan-map-bg.png',
} as const;
