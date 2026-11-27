// Dental House brand tokens (sampled from the logo + business card).
// Change values here only; every template reads from this file.
export const colors = {
  slate: "#333C39",
  slateDeep: "#1C2220",
  bronze: "#816951",
  bronzeDark: "#3D3622",
  bronzeLight: "#C9AB86",
  mist: "#C4CACA",
  white: "#F7F8F6",
} as const;

export const fonts = {
  headline: "Oswald", // 600/700, uppercase
  accent: "Instrument Serif", // italic, emotional accent words
  mono: "JetBrains Mono", // small labels, uppercase, 0.14em tracking
} as const;

/** Facts printed on end cards. Source: business card. Never invent others. */
export const clinic = {
  name: "Dental House",
  city: "Sialkot",
  phone: "0323-7560160",
  /** Same number takes WhatsApp bookings (confirmed by the owner, Nov 2026). */
  whatsapp: true,
  /** Spelling (two Ts) confirmed by the owner, Nov 2026. */
  instagram: "@dentalhousesktt",
  doctors: [
    "Dr. Usman Ilyas Bhutta (BDS, RDS)",
    "Dr. Ayesha Sarfraz (BDS, RDS)",
  ],
  /** Owner's wording, 2026-11-24. */
  address:
    "Ahsan Medical Centre, Opposite Allama Iqbal Memorial Teaching Hospital Emergency and Trauma Centre, Commissioner Road, Sialkot",
  /** Short form for tight end cards (owner's wording, Nov 2026). */
  addressShort: "Ahsan Medical Centre, Commissioner Road, Sialkot",
  /** Google Maps pin given by the owner (2026-11-24): "Dental House Sialkot" listing. Used for location animations. */
  location: { lat: 32.5054616, lng: 74.546536, maps: "https://maps.app.goo.gl/y763urRHxyerFtR29" },
} as const;

export const video = {
  width: 1080,
  height: 1920,
  fps: 30,
  /** Instagram/TikTok UI covers these areas of a 1080x1920 reel. Keep text out. */
  safe: { top: 220, bottom: 380, left: 60, right: 140 },
} as const;
