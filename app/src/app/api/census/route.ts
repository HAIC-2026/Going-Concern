import { NextRequest, NextResponse } from "next/server";

type Chamber = "House" | "Senate";

export async function GET(request: NextRequest) {
  const apiKey = process.env.CENSUS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Census API key is not configured." },
      { status: 500 }
    );
  }

  const chamberParam =
    request.nextUrl.searchParams.get("chamber") ?? "House";

  if (chamberParam !== "House" && chamberParam !== "Senate") {
    return NextResponse.json(
      { error: "Chamber must be House or Senate." },
      { status: 400 }
    );
  }

  const chamber: Chamber = chamberParam;

  const geography =
    chamber === "House"
      ? "state legislative district (lower chamber):*"
      : "state legislative district (upper chamber):*";

  const url = new URL("https://api.census.gov/data/2024/acs/acs5");

  url.searchParams.set("get", "NAME,B01001_001E,B19013_001E");
  url.searchParams.set("for", geography);
  url.searchParams.set("in", "state:15");
  url.searchParams.set("key", apiKey);

  try {
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Census API request failed.",
          status: response.status,
        },
        { status: 502 }
      );
    }

    const rows: string[][] = await response.json();

    if (!Array.isArray(rows) || rows.length < 2) {
      return NextResponse.json(
        { error: "Census returned no district data." },
        { status: 502 }
      );
    }

    // Preserve the original four-column rows so existing dashboard
    // population parsing (district code at index 3) keeps working.
    const populationRows = rows.map((row) =>
      [row[0], row[1], row[3], row[4]]
    );

    const incomeRows = rows.map((row) =>
      [row[0], row[2], row[3], row[4]]
    );

    return NextResponse.json({
      incomeRows,
      source: "U.S. Census Bureau",
      dataset: "2024 ACS 5-Year Estimates",
      metric: "Estimated total population and median household income",
      chamber,
      rows: populationRows,
    });
  } catch (error) {
    console.error("Census API error:", error);

    return NextResponse.json(
      { error: "Unable to connect to Census API." },
      { status: 502 }
    );
  }
}
