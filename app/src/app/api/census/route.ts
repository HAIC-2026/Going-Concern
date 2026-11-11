import { NextRequest, NextResponse } from "next/server";

type Chamber = "House" | "Senate";

// ACS 2024 5-year detailed-table variables.
const VARIABLES = [
  "NAME",
  "B01001_001E", // Total population
  "B19013_001E", // Median household income
  "B17001_001E", // Poverty universe
  "B17001_002E", // Below poverty level
  "B23025_003E", // Civilian labor force
  "B23025_005E", // Unemployed civilian labor force
  "B25077_001E", // Median owner-occupied home value
  "B25064_001E", // Median gross rent
  "B15003_001E", // Population age 25+ by educational attainment
  "B15003_022E", // Bachelor's degree
  "B15003_023E", // Master's degree
  "B15003_024E", // Professional school degree
  "B15003_025E", // Doctorate degree
] as const;

type Metric = number | null;

function validEstimate(raw: string | undefined): Metric {
  if (raw === undefined || raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  // ACS uses negative sentinel values for unavailable/suppressed estimates.
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function percentage(numerator: Metric, denominator: Metric): Metric {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.CENSUS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Census API key is not configured." },
      { status: 500 }
    );
  }

  const chamberParam = request.nextUrl.searchParams.get("chamber") ?? "House";
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
  url.searchParams.set("get", VARIABLES.join(","));
  url.searchParams.set("for", geography);
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

    const rawRows: string[][] = await response.json();
    if (!Array.isArray(rawRows) || rawRows.length < 2 || !Array.isArray(rawRows[0])) {
      return NextResponse.json(
        { error: "Census returned no district data." },
        { status: 502 }
      );
    }

    const headers = rawRows[0];
    const index = (variable: string) => headers.indexOf(variable);
    const geographyColumn =
      chamber === "House"
        ? "state legislative district (lower chamber)"
        : "state legislative district (upper chamber)";

    if (index(geographyColumn) < 0 || VARIABLES.some((variable) => index(variable) < 0)) {
      return NextResponse.json(
        { error: "Census response is missing required columns." },
        { status: 502 }
      );
    }

    // Preserve the existing four-column response contract used by the UI:
    // row[1] = metric, row[3] = district number.
    const makeLegacyRows = (variable: string): string[][] =>
      rawRows.map((row) => [
        row[index("NAME")],
        row[index(variable)],
        row[index("state")],
        row[index(geographyColumn)],
      ]);

    const rows = makeLegacyRows("B01001_001E");
    const incomeRows = makeLegacyRows("B19013_001E");

    const districts = rawRows.slice(1).map((row) => {
      const get = (variable: string) => validEstimate(row[index(variable)]);
      const educationCounts = [
        get("B15003_022E"),
        get("B15003_023E"),
        get("B15003_024E"),
        get("B15003_025E"),
      ];
      const educationTotal = educationCounts.every((value) => value !== null)
        ? educationCounts.reduce<number>((sum, value) => sum + (value ?? 0), 0)
        : null;

      return {
        name: row[index("NAME")],
        district: String(Number(row[index(geographyColumn)])),
        population: get("B01001_001E"),
        medianHouseholdIncome: get("B19013_001E"),
        povertyRate: percentage(get("B17001_002E"), get("B17001_001E")),
        unemploymentRate: percentage(get("B23025_005E"), get("B23025_003E")),
        medianHomeValue: get("B25077_001E"),
        medianGrossRent: get("B25064_001E"),
        bachelorsOrHigherRate: percentage(educationTotal, get("B15003_001E")),
      };
    });

    return NextResponse.json({
      incomeRows,
      source: "U.S. Census Bureau",
      dataset: "2024 ACS 5-Year Estimates",
      metric: "Population, income, poverty, unemployment, housing, and education",
      chamber,
      rows,
      districts,
    });
  } catch (error) {
    console.error("Census API error:", error);
    return NextResponse.json(
      { error: "Unable to connect to Census API." },
      { status: 502 }
    );
  }
}
