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
  /** Read from Instagram's own end-card overlay on the clinic's reels; owner confirmed the account. */
  instagram: "@dentalhousesktt",
  doctors: [
    "Dr. Usman Ilyas Bhutta (BDS, RDS, C. Implant)",
    "Dr. Ayesha Sarfraz (BDS, RDS)",
  ],
  address:
    "Ahsan Medical Centre, Opp. Trauma Centre Allama Iqbal Memorial Hospital, Commissioner Road, Sialkot",
} as const;

export const video = {
  width: 1080,
  height: 1920,
  fps: 30,
  /** Instagram/TikTok UI covers these areas of a 1080x1920 reel. Keep text out. */
  safe: { top: 220, bottom: 380, left: 60, right: 140 },
} as const;
