/**
 * Source de vérité visuelle de « Ma Finance Perso ».
 * Aucune couleur / rayon / ombre en dur ailleurs dans le code : tout part d'ici.
 *
 * DA « Nuit & Ambre » — dérivée du logo ITEKT Afrique (Côte d'Ivoire) :
 * un bleu marine profond qui porte le sérieux d'une app d'argent, un orange
 * ambré utilisé en accent rare (jamais en fond de grande surface).
 * Les couleurs de sens financier (gain / perte) sont volontairement tenues
 * à l'écart de la marque : une hausse est verte parce qu'elle est une hausse.
 */

/* ------------------------------------------------------------------ *
 * Marque
 * ------------------------------------------------------------------ */

/**
 * ⚠️ Contraste : `accent` (orange) ne porte QUE du texte sombre (`palette.light.text`).
 * `primary` (marine) ne porte QUE du texte clair.
 */
export const brand = {
  primary: "#16276B", // marine du logo — actions, courbe principale
  primaryDeep: "#0C1740", // marine saturée — fonds de héros, splash
  primaryLift: "#2B3F9E", // marine éclaircie — états pressés, dégradés
  accent: "#F2994A", // orange du logo — accents, KPI mis en avant, objectif atteint
  accentSoft: "#F7B77A", // orange clair — sous-titres sur fond marine, halos
  accentDeep: "#D97F2E",
} as const;

/** Dégradés signature (135°). Le héros mêle les deux couleurs du logo. */
export const gradient = {
  /** Carte « Fortune totale », en-tête de la vue d'ensemble. */
  hero: ["#0C1740", "#16276B", "#2B3F9E"] as const,
  /** Variante qui laisse entrer l'orange — réservée aux moments forts (objectif atteint). */
  heroWarm: ["#16276B", "#2B3F9E", "#F2994A"] as const,
  /** Accent pur — boutons secondaires, badges. */
  accent: ["#F2994A", "#F7B77A"] as const,
  /** Voile appliqué en bas des cartes-image pour garder le texte lisible. */
  scrim: ["rgba(12,23,64,0)", "rgba(12,23,64,0.85)"] as const,
  angle: 135,
} as const;

/* ------------------------------------------------------------------ *
 * Sémantique financière
 * ------------------------------------------------------------------ */

export const money = {
  gain: "#17B890", // vert-teal — hausse, économie réalisée
  loss: "#E5484D", // corail — baisse, dette
  neutral: "#8C97B8",
  /** Ambre plus jaune que l'orange de marque, pour rester distinguable d'un accent. */
  warning: "#E8A33D",
} as const;

/* ------------------------------------------------------------------ *
 * Neutres par thème (teintés marine pour l'unité chromatique)
 * ------------------------------------------------------------------ */

export const palette = {
  light: {
    bg: "#F6F7FB",
    surface: "#FFFFFF",
    surfaceAlt: "#EEF1F8",
    surfaceSunken: "#E5EAF5",
    border: "#DCE2F0",
    text: "#0B1230",
    textMuted: "#5A6488",
    /** Fond des feuilles modales / overlays. */
    scrim: "rgba(11,18,48,0.45)",
  },
  dark: {
    bg: "#070C1E",
    surface: "#0F1730",
    surfaceAlt: "#17203F",
    surfaceSunken: "#0A1128",
    border: "#242F55",
    text: "#EAEEF9",
    textMuted: "#8C97B8",
    scrim: "rgba(3,6,18,0.6)",
  },
} as const;

export type ThemeName = keyof typeof palette;
export type ThemeColors = (typeof palette)[ThemeName];

/* ------------------------------------------------------------------ *
 * Élévations
 * ------------------------------------------------------------------ */

/**
 * Échelle d'élévation. En thème sombre l'ombre ne se voit pas : c'est la
 * bordure et le palier de surface qui séparent les plans — d'où deux jeux.
 * `elevation` (Android) et `shadow*` (iOS) sont fournis ensemble : RN n'unifie pas.
 */
export const elevation = {
  light: {
    /** Cartes posées sur le fond. */
    card: {
      shadowColor: "#0B1230",
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    /** Éléments détachés : tab bar flottante, FAB, feuilles. */
    floating: {
      shadowColor: "#0B1230",
      shadowOpacity: 0.16,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 12 },
      elevation: 10,
    },
    /** Carte de héros teintée marine — l'ombre reprend la couleur de marque. */
    hero: {
      shadowColor: "#16276B",
      shadowOpacity: 0.32,
      shadowRadius: 32,
      shadowOffset: { width: 0, height: 16 },
      elevation: 12,
    },
    /** Halo orange — uniquement sur un état de réussite (objectif atteint). */
    accentGlow: {
      shadowColor: "#F2994A",
      shadowOpacity: 0.4,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
  },
  dark: {
    card: {
      shadowColor: "#000000",
      shadowOpacity: 0.4,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    floating: {
      shadowColor: "#000000",
      shadowOpacity: 0.55,
      shadowRadius: 30,
      shadowOffset: { width: 0, height: 14 },
      elevation: 12,
    },
    hero: {
      shadowColor: "#0B1230",
      shadowOpacity: 0.6,
      shadowRadius: 34,
      shadowOffset: { width: 0, height: 18 },
      elevation: 14,
    },
    accentGlow: {
      shadowColor: "#F2994A",
      shadowOpacity: 0.45,
      shadowRadius: 26,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    },
  },
} as const;

export type ElevationName = keyof (typeof elevation)["light"];

/* ------------------------------------------------------------------ *
 * Mouvement
 * ------------------------------------------------------------------ */

/**
 * Durées et courbes uniques pour toute l'app. Une transition financière doit
 * être rapide et nette : on ne fait pas « rebondir » un solde bancaire.
 * Les ressorts servent au tactile (pression, sélection), les durées au reste.
 */
export const motion = {
  duration: {
    /** Retour tactile immédiat (pression d'un bouton). */
    instant: 120,
    /** Transition d'état courante (onglet, filtre de période). */
    quick: 220,
    /** Entrée d'écran, dépliage de carte. */
    normal: 320,
    /** Animation d'un graphique au montage. */
    slow: 520,
  },
  /** Décalage entre éléments d'une liste qui entre en cascade. */
  stagger: 45,
  spring: {
    /** Pression : revient sans osciller. */
    press: { damping: 20, stiffness: 320, mass: 0.6 },
    /** Sélection / bascule : léger dépassement, reste sobre. */
    select: { damping: 16, stiffness: 220, mass: 0.8 },
    /** Feuille modale. */
    sheet: { damping: 22, stiffness: 180, mass: 1 },
  },
  /** Échelle atteinte par un élément pressé. */
  pressScale: 0.97,
} as const;

/* ------------------------------------------------------------------ *
 * Échelles catégorielles
 * ------------------------------------------------------------------ */

/**
 * Dépenses — les 8 catégories du classeur Excel. Fixe : une catégorie garde la
 * même couleur d'un écran à l'autre, sinon les pie charts deviennent illisibles
 * d'une période à la suivante.
 */
export const expenseColors = {
  logement: "#3B5BDB",
  nourriture: "#F2994A",
  transport: "#17B890",
  sorties: "#E064A8",
  divers: "#8C97B8",
  services: "#7C5CE0",
  achats: "#F5C24D",
  impots: "#E5484D",
} as const;

/** Patrimoine / portefeuille — pie d'allocation, portfolio idéal vs actuel. */
export const wealthColors = {
  liquide: "#17B890",
  comptes: "#16276B",
  actions: "#3B5BDB",
  obligations: "#7C5CE0",
  immobilier: "#F2994A",
  crypto: "#F5C24D",
  autres: "#8C97B8",
} as const;

/**
 * Repli pour les séries dont la clé n'est pas connue à l'avance (catégories
 * personnalisées, classes d'actif ajoutées par l'utilisateur). Ordonnée pour
 * maximiser le contraste entre tranches voisines d'un pie chart.
 */
export const seriesFallback = [
  "#16276B",
  "#F2994A",
  "#3B5BDB",
  "#17B890",
  "#E064A8",
  "#F5C24D",
  "#7C5CE0",
  "#2B3F9E",
  "#E5484D",
  "#8C97B8",
] as const;

/** Couleur stable pour une clé, avec repli déterministe sur `seriesFallback`. */
export function colorForKey(
  key: string,
  scale: Record<string, string> = {},
): string {
  const direct = scale[key];
  if (direct) return direct;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return seriesFallback[hash % seriesFallback.length]!;
}

/* ------------------------------------------------------------------ *
 * Formes, espacement, typographie
 * ------------------------------------------------------------------ */

export const radius = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

/**
 * Les tailles « amount » existent parce que l'écran est dense : un montant doit
 * se lire d'un coup d'œil sans écraser le reste de la carte.
 */
export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: "700" },
  h1: { fontSize: 28, lineHeight: 34, fontWeight: "700" },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: "600" },
  h3: { fontSize: 17, lineHeight: 24, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400" },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: "700", letterSpacing: 1.1 },
  amountXl: { fontSize: 38, lineHeight: 44, fontWeight: "700" },
  amountLg: { fontSize: 28, lineHeight: 34, fontWeight: "700" },
  amountMd: { fontSize: 20, lineHeight: 26, fontWeight: "600" },
  amountSm: { fontSize: 15, lineHeight: 20, fontWeight: "600" },
} as const;

/* ------------------------------------------------------------------ *
 * Graphiques
 * ------------------------------------------------------------------ */

/** Opacités du remplissage d'un area chart — la courbe reste lisible sous la teinte. */
export const chartFill = { start: 0.35, end: 0.02 } as const;

/**
 * Hauteurs de référence des graphiques. Fixées ici pour que deux pie charts
 * comparés côte à côte (portfolio idéal vs actuel) aient exactement la même taille.
 */
export const chartSize = {
  sparkline: 56,
  compact: 140,
  standard: 200,
  tall: 260,
  pieRadius: 82,
  pieRadiusCompact: 58,
  donutInnerRatio: 0.62,
} as const;
