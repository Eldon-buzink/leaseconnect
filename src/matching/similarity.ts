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
 */
export function calculateMatchScore(params: {
  make: { offer: string | null; canonical: string | null };
  model: { offer: string | null; canonical: string | null };
  year: { offer: number | null; canonical: number | null };
  trim: { offer: string | null; canonical: string | null };
  fuelType?: { offer: string | null; canonical: string | null };
}): number {
  // Field weights
  const WEIGHTS = {
    make: 0.3,
    model: 0.4,
    year: 0.15,
    trim: 0.1,
    fuelType: 0.05,
  };

  // Calculate individual scores
  const makeScore = stringSimilarity(params.make.offer, params.make.canonical);
  const modelScore = Math.max(
    stringSimilarity(params.model.offer, params.model.canonical),
    tokenSimilarity(params.model.offer, params.model.canonical)
  );
  const yearScore = yearSimilarity(params.year.offer, params.year.canonical);
  const trimScore = trimSimilarity(params.trim.offer, params.trim.canonical);
  const fuelScore = params.fuelType
    ? stringSimilarity(params.fuelType.offer, params.fuelType.canonical)
    : 0;

  // Weighted sum
  const totalScore =
    makeScore * WEIGHTS.make +
    modelScore * WEIGHTS.model +
    yearScore * WEIGHTS.year +
    trimScore * WEIGHTS.trim +
    fuelScore * WEIGHTS.fuelType;

  return Math.min(1.0, Math.max(0.0, totalScore));
}

