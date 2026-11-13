/** Auditable SNAP estimates: ACS 5-year Subject Table S2201, 90% confidence MOEs. */
export type Chamber = "House" | "Senate";
export type RawEstimate = { estimate: number | null; moe: number | null; id: string };
export type RawSNAP = {
  total: RawEstimate;
  receiving: RawEstimate;
  notReceiving: RawEstimate;
};
export type GeoSnap = {
  name: string; code: string; kind: "district" | "county" | "state";
  chamber?: Chamber; countyCode?: string | null;
  counties?: Array<{ code: string; name: string; population: number }>;
  snap: RawSNAP;
};
export type OutreachCache = {
  vintage: number; fetchedAt: string; dataset: string; geographyVintage: string;
  state: GeoSnap; counties: GeoSnap[]; districts: GeoSnap[];
  validations: { metadataVerified: boolean; districtCounts: { House: number; Senate: number }; countyMappingMethod: string };
};
export type Quantity = { value: number | null; moe: number | null; cv: number | null; caution: boolean };
export type SnapStats = {
  total: Quantity; receiving: Quantity; gap: Quantity; rate: Quantity;
  source: string;
};
const z = (x: number | null | undefined): x is number => x !== null && x !== undefined && Number.isFinite(x) && x >= 0;
function quantity(v: number | null, m: number | null): Quantity {
  const cv = z(v) && v > 0 && z(m) ? m / 1.645 / v : null;
  return { value: z(v) ? v : null, moe: z(m) ? m : null, cv, caution: cv !== null && cv > .30 };
}
export function ratioMoeSubset(n: number, d: number, nm: number, dm: number): number {
  // ACS Handbook: when numerator is a subset of denominator, use subtraction under the radical.
  // If sampling noise makes it negative, fall back to the general ratio approximation.
  const r = n / d;
  const subset = nm * nm - r * r * dm * dm;
  return 100 * Math.sqrt(subset >= 0 ? subset : nm * nm + r * r * dm * dm) / d;
}
export function calcSnap(s: GeoSnap, vintage: number): SnapStats {
  const a=s.snap.total, b=s.snap.receiving, c=s.snap.notReceiving;
  const denominator = quantity(a.estimate,a.moe);
  const receiving = quantity(b.estimate,b.moe);
  const gap = quantity(c.estimate,c.moe);
  let rate=quantity(null,null);
  if(z(a.estimate) && a.estimate>0 && z(b.estimate) && b.estimate<=a.estimate) {
    const p = 100*b.estimate/a.estimate;
    const m=z(a.moe)&&z(b.moe)?ratioMoeSubset(b.estimate,a.estimate,b.moe,a.moe):null;
    rate=quantity(p,m);
  }
  return {total:denominator,receiving,gap,rate,
    source:`U.S. Census Bureau • ${vintage} ACS 5-Year • S2201 C01/C03/C05 row 021 • ${s.name}`};
}
export function whatIf(d:SnapStats, comparison:SnapStats) {
  const eligible=d.total.value, base=d.rate.value, target=comparison.rate.value;
  if(eligible===null||base===null||target===null) return null;
  const difference=Math.max(0,target-base);
  const additional=Math.max(0,Math.round(eligible*difference/100));
  // First-order 90% MOE approximation. District and county/state overlap, so their
  // covariance is unknown; uncertainty in modeled outcomes cannot be exact.
  const em=d.total.moe, rm=d.rate.moe, cm=comparison.rate.moe;
  const moe=em!==null&&rm!==null&&cm!==null
    ? Math.sqrt(Math.pow(difference*em/100,2)+Math.pow(eligible*rm/100,2)+Math.pow(eligible*cm/100,2))
    : null;
  return {eligible,base,target,additional,moe,alreadyAtOrAbove:base>=target,approximation:true};
}
export const SNAP_SOURCE_URL="https://api.census.gov/data/";
export const OFFICIAL_SNAP="https://humanservices.hawaii.gov/bessd/snap./";
export const OFFICIAL_MEDQUEST="https://medical.mybenefits.hawaii.gov/";
