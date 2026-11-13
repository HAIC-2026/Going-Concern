import { NextRequest, NextResponse } from "next/server";

type Chamber = "House" | "Senate";
type Values = Record<string, number | null>;
const BASE = "https://api.census.gov/data/2024/acs/acs5";
const maleSenior = [20, 21, 22, 23, 24, 25];
const femaleSenior = [44, 45, 46, 47, 48, 49];
const disabilities = [4, 7, 10, 13, 16, 19, 23, 26, 29, 32, 35, 38];
const id = (table: string, n: number) => `${table}_${String(n).padStart(3, "0")}E`;
const needed = Array.from(new Set([
  "B01001_001E", ...maleSenior.map(n => id("B01001", n)), ...femaleSenior.map(n => id("B01001", n)),
  "B01002_001E", "B22001_001E", "B22001_002E",
  ...[1,7,8,9,10,11].map(n => id("B25070", n)),
  "B28002_001E", "B28002_013E", "B25044_001E", "B25044_003E", "B25044_010E",
  "B25003_001E", "B25003_003E", "B25002_001E", "B25002_003E",
  "B18101_001E", ...disabilities.map(n => id("B18101", n)),
]));
const available = (raw: unknown) => {
  if (raw == null || raw === "" || raw === "null") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n < 1e9 ? n : null;
};
const at = (v: Values, k: string) => v[k] ?? null;
function sum(v: Values, keys: string[]) {
  const n = keys.map(k => at(v, k));
  return n.every(x => x !== null) ? n.reduce<number>((a,b) => a + (b as number), 0) : null;
}
function ratio(n: number | null, d: number | null) {
  if (n === null || d === null || d <= 0 || n < 0 || n > d) return null;
  return Math.round((1000 * n / d)) / 10;
}
function calculate(v: Values) {
  const seniors = sum(v, [...maleSenior.map(n=>id("B01001",n)),...femaleSenior.map(n=>id("B01001",n))]);
  const rentKnown = at(v,"B25070_001E") !== null && at(v,"B25070_011E") !== null ?
    (at(v,"B25070_001E") as number) - (at(v,"B25070_011E") as number) : null;
  const rent30 = sum(v, [7,8,9,10].map(n=>id("B25070",n)));
  return {
    seniors65Count:seniors,
    seniors65Pct:ratio(seniors,at(v,"B01001_001E")),
    medianAge:at(v,"B01002_001E"),
    snapHouseholdsPct:ratio(at(v,"B22001_002E"),at(v,"B22001_001E")),
    rentBurdenPct:ratio(rent30,rentKnown),
    severeRentBurdenPct:ratio(at(v,"B25070_010E"),rentKnown),
    noInternetPct:ratio(at(v,"B28002_013E"),at(v,"B28002_001E")),
    noVehiclePct:ratio(sum(v,["B25044_003E","B25044_010E"]),at(v,"B25044_001E")),
    renterOccupiedPct:ratio(at(v,"B25003_003E"),at(v,"B25003_001E")),
    vacantHousingPct:ratio(at(v,"B25002_003E"),at(v,"B25002_001E")),
    disabilityPct:ratio(sum(v,disabilities.map(n=>id("B18101",n))),at(v,"B18101_001E")),
  };
}
const metrics = [
  {key:"seniors65Pct",label:"Residents age 65+",unit:"%",source:"B01001",note:"Residents age 65 and older as a share of all residents"},
  {key:"seniors65Count",label:"Residents age 65+ (count)",unit:"count",source:"B01001",note:"Estimated total residents age 65 and older"},
  {key:"medianAge",label:"Median age",unit:"years",source:"B01002",note:"Median age of residents"},
  {key:"snapHouseholdsPct",label:"Households receiving SNAP",unit:"%",source:"B22001",note:"Households reporting SNAP receipt in past 12 months"},
  {key:"rentBurdenPct",label:"Rent burdened (30%+)",unit:"%",source:"B25070",note:"Renter households paying at least 30% of income in gross rent; excludes 'not computed'"},
  {key:"severeRentBurdenPct",label:"Severely rent burdened (50%+)",unit:"%",source:"B25070",note:"Renter households paying 50% or more; excludes 'not computed'"},
  {key:"noInternetPct",label:"Households without internet",unit:"%",source:"B28002",note:"Households reporting no internet access"},
  {key:"noVehiclePct",label:"Households without vehicles",unit:"%",source:"B25044",note:"Occupied households with zero vehicles available"},
  {key:"renterOccupiedPct",label:"Renter-occupied households",unit:"%",source:"B25003",note:"Renter-occupied share of occupied housing units"},
  {key:"vacantHousingPct",label:"Vacant housing units",unit:"%",source:"B25002",note:"Vacant share of all housing units; not a short-term rental measure"},
  {key:"disabilityPct",label:"Residents with disability",unit:"%",source:"B18101",note:"Civilian noninstitutionalized population with a reported disability"},
];

async function fetchCensus(chamber: Chamber) {
  const geo = `state legislative district (${chamber === "House" ? "lower" : "upper"} chamber)`;
  const key = process.env.CENSUS_API_KEY?.trim();
  const params = new URLSearchParams({get:["NAME",...needed].join(","),for:`${geo}:*`,in:"state:15"});
  if (key) params.set("key",key);
  const response = await fetch(`${BASE}?${params.toString()}`,{next:{revalidate:86400}});
  if (!response.ok) throw new Error(`Census returned HTTP ${response.status}; ${key ? "verify API service" : "add CENSUS_API_KEY to .env.local if required"}`);
  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || rows.length < 2 || !Array.isArray(rows[0])) throw new Error("Census response did not include district rows");
  const headers = rows[0] as string[];
  const geoIndex = headers.indexOf(geo);
  if (geoIndex < 0) throw new Error(`Missing ${geo} field in Census response`);
  return rows.slice(1).map((raw:unknown) => {
    if (!Array.isArray(raw)) return null;
    const code = String(raw[geoIndex] ?? "");
    if (!/^\d{1,3}$/.test(code)) return null;
    const district = Number(code);
    if (district < 1 || district > (chamber === "House" ? 51 : 25)) return null;
    const v: Values = Object.fromEntries(needed.map(k=>[k,available(raw[headers.indexOf(k)])]));
    return {chamber,district,values:calculate(v)};
  }).filter((x):x is NonNullable<typeof x> => x !== null).sort((a,b)=>a.district-b.district);
}

export async function GET(request:NextRequest) {
  const selected=request.nextUrl.searchParams.get("chamber") ?? "House";
  if (selected!=="House"&&selected!=="Senate") return NextResponse.json({error:"Use chamber=House or chamber=Senate"},{status:400});
  try {
    const districts=await fetchCensus(selected);
    if (districts.length < (selected === "House" ? 45 : 20)) throw new Error(`Only ${districts.length} districts returned; data incomplete`);
    return NextResponse.json({chamber:selected,year:2024,dataset:"ACS 5-Year Estimates",source:BASE,metrics,districts,limitations:"ACS estimates, not annual observations; rates derived from estimates. Margins of error have not been propagated for derived rates. Avoid treating small differences as statistically significant."});
  } catch(e) {
    console.error("Analytics Census request failed",e);
    return NextResponse.json({error:e instanceof Error?e.message:"Census data unavailable",source:BASE},{status:502});
  }
}
