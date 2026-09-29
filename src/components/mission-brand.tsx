import Image, { type StaticImageData } from "next/image";
import kairosLogo from "@/assets/kairos/logo.webp";
import kairosCover from "@/assets/kairos/portada.webp";

type Brand = { cover: StaticImageData; coverAlt: string; logo: StaticImageData; logoAlt: string };

/**
 * Marca del grupo convocante por misión (portada y logo). Se define por slug
 * para que una misión nueva no herede la imagen de otra.
 */
const BRANDS: Record<string, Brand> = {
  "choco-2026-01": {
    cover: kairosCover,
    coverAlt: "Kairós Life · Misión Reconocimiento, etapa 2 · Chocó, 9 al 12 de octubre de 2026 · “Vayan por todo el mundo y anuncien la buena nueva”",
    logo: kairosLogo,
    logoAlt: "Grupo Kairós",
  },
};

export function missionBrand(mission: { slug: string }): Brand | null {
  return BRANDS[mission.slug] ?? null;
}

/** Portada de la misión, a todo el ancho del contenido. */
export function MissionCover({ mission }: { mission: { slug: string } }) {
  const brand = missionBrand(mission);
  if (!brand) return null;
  return <Image src={brand.cover} alt={brand.coverAlt} priority sizes="(max-width: 800px) 100vw, 768px" className="w-full rounded-2xl" />;
}

/** Logo del grupo convocante (altura fija, ancho automático). */
export function MissionLogo({ mission, className = "h-7" }: { mission: { slug: string }; className?: string }) {
  const brand = missionBrand(mission);
  if (!brand) return null;
  return <Image src={brand.logo} alt={brand.logoAlt} className={`w-auto ${className}`} />;
}
