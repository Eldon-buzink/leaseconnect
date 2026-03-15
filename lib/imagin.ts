/**
 * Imagin.studio getImage API – build CDN image URL for a vehicle.
 * Docs: https://docs.imagin.studio/guides/getting-images/
 *
 * Required from you: set NEXT_PUBLIC_IMAGIN_CUSTOMER_KEY in .env.local (and Vercel)
 * with your Imagin customer key.
 */

const IMAGIN_BASE = 'https://cdn.imagin.studio/getImage';
const CUSTOMER_KEY = process.env.NEXT_PUBLIC_IMAGIN_CUSTOMER_KEY ?? '';

function slug(value: string | null | undefined): string {
  if (!value || typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/** Map our fuel_type to Imagin powerTrain (petrol, electric, hybrid, diesel). */
function toPowerTrain(fuelType: string | null | undefined): string | undefined {
  if (!fuelType) return undefined;
  const f = fuelType.toLowerCase();
  if (f.includes('electric') || f === 'elektrisch 100%') return 'electric';
  if (f.includes('hybrid')) return 'hybrid';
  if (f.includes('diesel')) return 'diesel';
  if (f.includes('petrol') || f.includes('benzine')) return 'petrol';
  return undefined;
}

export interface ImaginParams {
  make: string;
  model: string;
  trim?: string | null;
  year?: number | null;
  fuelType?: string | null;
  /** Imagin angle (e.g. "01", "23"). Default "01". */
  angle?: string;
  /** Imagin zoomtype (e.g. "fullscreen"). */
  zoomtype?: string;
}

/**
 * Returns the Imagin getImage URL for the given vehicle, or null if the
 * customer key is not set. Use this URL as <img src={url} />.
 * Images must be loaded from the CDN (no server-side caching).
 */
export function getImaginImageUrl(params: ImaginParams): string | null {
  if (!CUSTOMER_KEY) return null;

  const make = slug(params.make) || params.make?.toLowerCase().trim();
  const modelFamily = params.model?.trim() ?? '';
  if (!make || !modelFamily) return null;

  const search = new URLSearchParams();
  search.set('customer', CUSTOMER_KEY);
  search.set('make', make);
  search.set('modelFamily', modelFamily);

  if (params.year != null && params.year > 0) {
    search.set('modelYear', String(params.year));
  }
  const powerTrain = toPowerTrain(params.fuelType);
  if (powerTrain) {
    search.set('powerTrain', powerTrain);
  }
  if (params.trim) {
    const range = slug(params.trim);
    if (range) search.set('modelRange', range);
  }
  if (params.angle) search.set('angle', params.angle);
  if (params.zoomtype) search.set('zoomtype', params.zoomtype);

  return `${IMAGIN_BASE}?${search.toString()}`;
}

export function isImaginConfigured(): boolean {
  return Boolean(CUSTOMER_KEY);
}
