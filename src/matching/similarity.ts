/**
 * Similarity calculation functions for matching.
 */

/**
 * Calculate Levenshtein distance between two strings.
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Calculate normalized similarity score (0.0 to 1.0) using Levenshtein distance.
 */
export function stringSimilarity(str1: string | null, str2: string | null): number {
  if (!str1 || !str2) return 0.0;
  if (str1 === str2) return 1.0;

  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1.0;

  return 1.0 - distance / maxLength;
}

/**
 * Calculate token-based similarity (for multi-word strings).
 */
export function tokenSimilarity(str1: string | null, str2: string | null): number {
  if (!str1 || !str2) return 0.0;
  if (str1 === str2) return 1.0;

  const tokens1 = str1.toLowerCase().split(/\s+/);
  const tokens2 = str2.toLowerCase().split(/\s+/);

  const intersection = tokens1.filter((token) => tokens2.includes(token));
  const union = new Set([...tokens1, ...tokens2]);

  if (union.size === 0) return 1.0;
  return intersection.length / union.size;
}

/**
 * Calculate year similarity score.
 */
export function yearSimilarity(year1: number | null, year2: number | null): number {
  if (!year1 || !year2) return 0.5; // Neutral if missing
  if (year1 === year2) return 1.0;

  const diff = Math.abs(year1 - year2);
  if (diff === 1) return 0.8;
  if (diff === 2) return 0.5;
  if (diff <= 3) return 0.3;
  return 0.0;
}

/**
 * Calculate trim similarity score.
 */
export function trimSimilarity(trim1: string | null, trim2: string | null): number {
  if (!trim1 && !trim2) return 1.0; // Both missing
  if (!trim1 || !trim2) return 0.5; // One missing - neutral

  const t1 = trim1.toLowerCase();
  const t2 = trim2.toLowerCase();

  if (t1 === t2) return 1.0;
  if (t1.includes(t2) || t2.includes(t1)) return 0.7; // Contains match
  return stringSimilarity(trim1, trim2);
}

/**
 * Calculate overall match score using weighted fields.
 * Simple wrapper that returns only the overall score.
 */
export function calculateMatchScore(params: {
  make: { offer: string | null; canonical: string | null };
  model: { offer: string | null; canonical: string | null };
  year: { offer: number | null; canonical: number | null };
  trim: { offer: string | null; canonical: string | null };
  fuelType?: { offer: string | null; canonical: string | null };
  transmission?: { offer: string | null; canonical: string | null };
  powerHp?: { offer: number | null; canonical: number | null };
}): number {
  const detailed = calculateMatchScoreDetailed(params);
  return detailed.overall;
}

export interface MatchScoreComponents {
  make: number;
  model: number;
  year: number;
  trim: number;
  fuelType: number;
  transmission: number;
  powerHp: number;
  overall: number;
}

function numericSimilarity(v1: number | null, v2: number | null): number {
  if (v1 == null || v2 == null) return 0.5;
  if (v1 === v2) return 1.0;
  const diff = Math.abs(v1 - v2);
  const max = Math.max(v1, v2);
  const pct = diff / max;
  if (pct <= 0.05) return 0.9;
  if (pct <= 0.1) return 0.8;
  if (pct <= 0.2) return 0.6;
  return 0.3;
}

function transmissionSimilarity(t1: string | null, t2: string | null): number {
  if (!t1 && !t2) return 1.0;
  if (!t1 || !t2) return 0.5;
  return stringSimilarity(t1, t2);
}

/**
 * Detailed score with per-field components for explanations.
 */
export function calculateMatchScoreDetailed(params: {
  make: { offer: string | null; canonical: string | null };
  model: { offer: string | null; canonical: string | null };
  year: { offer: number | null; canonical: number | null };
  trim: { offer: string | null; canonical: string | null };
  fuelType?: { offer: string | null; canonical: string | null };
  transmission?: { offer: string | null; canonical: string | null };
  powerHp?: { offer: number | null; canonical: number | null };
}): MatchScoreComponents {
  // Rebalanced weights
  const WEIGHTS = {
    make: 0.25,
    model: 0.35,
    year: 0.15,
    trim: 0.1,
    fuelType: 0.05,
    transmission: 0.05,
    powerHp: 0.05,
  } as const;

  const makeScore = stringSimilarity(params.make.offer, params.make.canonical);
  const modelScore = Math.max(
    stringSimilarity(params.model.offer, params.model.canonical),
    tokenSimilarity(params.model.offer, params.model.canonical)
  );
  const yearScore = yearSimilarity(params.year.offer, params.year.canonical);
  const trimScore = trimSimilarity(params.trim.offer, params.trim.canonical);
  const fuelScore = params.fuelType
    ? stringSimilarity(params.fuelType.offer, params.fuelType.canonical)
    : 0.5;
  const transmissionScore = params.transmission
    ? transmissionSimilarity(params.transmission.offer, params.transmission.canonical)
    : 0.5;
  const powerScore = params.powerHp
    ? numericSimilarity(params.powerHp.offer, params.powerHp.canonical)
    : 0.5;

  const overall = Math.min(
    1.0,
    Math.max(
      0.0,
      makeScore * WEIGHTS.make +
        modelScore * WEIGHTS.model +
        yearScore * WEIGHTS.year +
        trimScore * WEIGHTS.trim +
        fuelScore * WEIGHTS.fuelType +
        transmissionScore * WEIGHTS.transmission +
        powerScore * WEIGHTS.powerHp
    )
  );

  return {
    make: makeScore,
    model: modelScore,
    year: yearScore,
    trim: trimScore,
    fuelType: fuelScore,
    transmission: transmissionScore,
    powerHp: powerScore,
    overall,
  };
}

