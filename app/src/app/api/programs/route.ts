import { NextRequest, NextResponse } from "next/server";
import { matchPrograms, type District } from "../../../lib/programMatching";

export async function GET(request: NextRequest) {
  const chamber = request.nextUrl.searchParams.get("chamber") ?? "House";
  const district = request.nextUrl.searchParams.get("district") ?? "13";
  if (chamber !== "House" && chamber !== "Senate") return NextResponse.json({ error: "Invalid chamber" }, { status: 400 });
  if (!/^\d{1,2}$/.test(district)) return NextResponse.json({ error: "Invalid district" }, { status: 400 });
  const districtNum = Number(district);
  if (districtNum < 1 || districtNum > (chamber === "House" ? 51 : 25)) return NextResponse.json({ error: "District out of range" }, { status: 400 });
  try {
    const censusUrl = new URL("/api/census", request.url);
    censusUrl.searchParams.set("chamber", chamber);
    const censusResponse = await fetch(censusUrl, { cache: "no-store" });
    if (!censusResponse.ok) throw new Error(`Census service returned ${censusResponse.status}`);
    const data = await censusResponse.json();
    if (!Array.isArray(data.districts)) throw new Error("District data missing");
    const districts = data.districts as District[];
    const selected = districts.find(d => Number(d.district) === districtNum);
    if (!selected) return NextResponse.json({ error: "District not in Census response" }, { status: 404 });
    return NextResponse.json({
      chamber, district: selected, dataset: "2024 ACS 5-Year Estimates", source: "U.S. Census Bureau",
      matchingMethod: "Screened using poverty, unemployment and median household income relative to median estimates of districts in the same chamber. No eligibility assessment or enrollment-gap calculation.",
      matches: matchPrograms(selected, districts),
    });
  } catch (error) {
    console.error("Program matching error", error);
    return NextResponse.json({ error: "Unable to retrieve district indicators. No program matches can be assessed." }, { status: 502 });
  }
}
