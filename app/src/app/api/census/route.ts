
import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.CENSUS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Census API key is not configured." },
      { status: 500 }
    );
  }

  const url = new URL("https://api.census.gov/data/2024/acs/acs5");

  url.searchParams.set("get", "NAME,B01001_001E");
  url.searchParams.set(
    "for",
    "state legislative district (lower chamber):*"
  );
  url.searchParams.set("in", "state:15");
  url.searchParams.set("key", apiKey);

  try {
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Census API request failed.", status: response.status },
        { status: 502 }
      );
    }

    const rows: string[][] = await response.json();

    return NextResponse.json({
      source: "U.S. Census Bureau",
      dataset: "2024 ACS 5-Year Estimates",
      metric: "Estimated total population",
      rows,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to connect to Census API." },
      { status: 502 }
    );
  }
}
