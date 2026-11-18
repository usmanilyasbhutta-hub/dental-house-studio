// Clinic facts printed on sheets come only from the studio's src/brand.ts (golden rule 5: never a second copy).
import { clinic } from "../../../src/brand";

export const CLINIC = {
  name: clinic.name,
  city: clinic.city,
  /** phone and WhatsApp (same number) */
  phone: clinic.phone,
} as const;
