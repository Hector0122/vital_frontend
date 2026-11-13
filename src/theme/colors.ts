/** Paleta de Vital — oscuro por defecto, sobrio. Fuente: arcd_kit/tokens.ts. */
import { createAppTheme, brands, hues } from './tokens';

const theme = createAppTheme(brands.vital).dark;

export const colors = {
  background: theme.background,
  surface: theme.surface,
  surfaceAlt: theme.surfaceAlt,
  border: theme.border,
  primary: theme.primary,
  primarySoft: theme.primarySoft,
  accent: theme.accent,
  text: theme.text,
  muted: theme.textSecondary,
  danger: theme.danger,
  // Texto sobre `primary`: el teal es claro, el blanco no da contraste.
  onPrimary: '#0A0B0D',
} as const;

// Acentos suaves por área (mismos hex del kit, sin inventar colores). Nada de
// verde/rojo con significado de éxito/fracaso.
export const areaHues = [hues.teal, hues.purple, hues.amber, hues.azure, hues.slateBlue] as const;
