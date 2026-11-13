import programs from "../data/programs.json";

export type Chamber = "House" | "Senate";
export type IndicatorKey = "population" | "medianHouseholdIncome" | "povertyRate" | "unemploymentRate" | "medianHomeValue" | "medianGrossRent" | "bachelorsOrHigherRate";
export type District = { district: string; name: string } & Record<IndicatorKey, number | null>;
export type Program = (typeof programs)[number];
export type Match = { program: Program; evidence: Array<{ indicator: IndicatorKey; districtValue: number; referenceMedian: number; direction: string }>; explanation: string; status: "indicator-supported" | "not-assessed" };

// Only apply rules to indicators actually measured by the current Census endpoint.
// These are *relative outreach signals*, not eligibility or unmet-enrollment estimates.
const RULES: Partial<Record<IndicatorKey, "higher" | "lower">> = {
  povertyRate: "higher",
  medianHouseholdIncome: "lower",
  unemploymentRate: "higher",
};

function median(values: number[]): number | null {
  const clean = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b);
  if (!clean.length) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[mid] : (clean[mid-1] + clean[mid]) / 2;
}

export function matchPrograms(selected: District, peerDistricts: District[]): Match[] {
  return programs.map(program => {
    const evidence: Match["evidence"] = [];
    for (const key of program.matchedIndicators as string[]) {
      if (!(key in RULES)) continue;
      const indicator = key as IndicatorKey;
      const districtValue = selected[indicator];
      const referenceMedian = median(peerDistricts.map(d => d[indicator]).filter((n): n is number => n !== null && Number.isFinite(n)));
      if (districtValue === null || !Number.isFinite(districtValue) || referenceMedian === null) continue;
      const direction = RULES[indicator];
      // Relative to median across legislative districts in the SAME chamber.
      if ((direction === "higher" && districtValue > referenceMedian) || (direction === "lower" && districtValue < referenceMedian)) {
        evidence.push({ indicator, districtValue, referenceMedian, direction: direction === "higher" ? "above" : "below" });
      }
    }
    return {
      program,
      evidence,
      status: evidence.length ? "indicator-supported" as const : "not-assessed" as const,
      explanation: evidence.length
        ? "District economic indicators suggest this program may be worth reviewing for outreach. No resident eligibility or enrollment gap has been determined."
        : "No relevant indicator exceeded the current screening rule, or the necessary population-specific indicator is not available. This does not mean residents are ineligible.",
    };
  }).sort((a,b) => b.evidence.length-a.evidence.length || a.program.name.localeCompare(b.program.name));
}
