
import { NextRequest, NextResponse } from "next/server";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const VARIABLES = [
  "NAME",
  "B01001_001E",
  "B19013_001E",
  "B17001_001E",
  "B17001_002E",
  "B23025_003E",
  "B23025_005E",
  "B25077_001E",
  "B25064_001E",
  "B15003_001E",
  "B15003_022E",
  "B15003_023E",
  "B15003_024E",
  "B15003_025E",
];

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function rate(
  numerator: number | null,
  denominator: number | null
): number | null {
  if (numerator === null || denominator === null || denominator <= 0) {
    return null;
  }

  return Math.round((numerator / denominator) * 1000) / 10;
}

async function getDistricts(chamber: "House" | "Senate") {
  const geography =
    chamber === "House"
      ? "state legislative district (lower chamber)"
      : "state legislative district (upper chamber)";

  const params = new URLSearchParams({
    get: VARIABLES.join(","),
    for: `${geography}:*`,
    in: "state:15",
  });

  if (process.env.CENSUS_API_KEY) {
    params.set("key", process.env.CENSUS_API_KEY);
  }

  const response = await fetch(
    `https://api.census.gov/data/2024/acs/acs5?${params.toString()}`,
    { next: { revalidate: 3600 } }
  );

  if (!response.ok) {
    throw new Error(`Census API error: ${response.status}`);
  }

  const table: string[][] = await response.json();

  if (!Array.isArray(table) || table.length < 2) {
    throw new Error("No Census data returned.");
  }

  const headers = table[0];

  const column = (name: string) => {
    const index = headers.indexOf(name);
    if (index < 0) throw new Error(`Missing Census column ${name}`);
    return index;
  };

  const districtColumn = headers.findIndex((header) =>
    header.startsWith("state legislative district")
  );

  if (districtColumn < 0) {
    throw new Error("Missing district column.");
  }

  return table.slice(1).map((row) => {
    const value = (name: string) =>
      numberOrNull(row[column(name)]);

    const degreeValues = [
      "B15003_022E",
      "B15003_023E",
      "B15003_024E",
      "B15003_025E",
    ].map(value);

    const degrees = degreeValues.every((item) => item !== null)
      ? degreeValues.reduce<number>(
          (sum, item) => sum + (item ?? 0),
          0
        )
      : null;

    return {
      chamber,
      district: Number(row[districtColumn]),
      population: value("B01001_001E"),
      medianHouseholdIncome: value("B19013_001E"),
      povertyRate: rate(
        value("B17001_002E"),
        value("B17001_001E")
      ),
      unemploymentRate: rate(
        value("B23025_005E"),
        value("B23025_003E")
      ),
      medianHomeValue: value("B25077_001E"),
      medianGrossRent: value("B25064_001E"),
      bachelorsOrHigherRate: rate(
        degrees,
        value("B15003_001E")
      ),
    };
  }).filter((district) =>
    Number.isInteger(district.district) && district.district > 0
  );
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is missing from .env.local." },
        { status: 500 }
      );
    }

    const body = await request.json();

    const rawMessages: unknown[] = Array.isArray(body.messages)
      ? body.messages
      : typeof body.message === "string"
        ? [{ role: "user", content: body.message }]
        : typeof body.question === "string"
          ? [{ role: "user", content: body.question }]
          : [];

    const messages: ChatMessage[] = rawMessages
      .filter((item): item is ChatMessage => {
        if (!item || typeof item !== "object") return false;
        const message = item as Record<string, unknown>;

        return (
          (message.role === "user" ||
            message.role === "assistant") &&
          typeof message.content === "string" &&
          message.content.length > 0 &&
          message.content.length <= 4000
        );
      })
      .slice(-10);

    if (
      messages.length === 0 ||
      messages[messages.length - 1].role !== "user"
    ) {
      return NextResponse.json(
        { error: "A user message is required." },
        { status: 400 }
      );
    }

    const [house, senate] = await Promise.all([
      getDistricts("House"),
      getDistricts("Senate"),
    ]);

    const instructions = `
You are the AI Insights assistant for a Hawaiʻi
legislative district intelligence platform.

You have district-level data from the U.S. Census
Bureau's 2024 ACS 5-Year Estimates.

Rules:
- Base all numerical district claims on the supplied data.
- Never invent statistics or district rankings.
- Identify House versus Senate districts clearly.
- For rankings, sort the actual numeric values.
- Exclude null values from rankings and calculations.
- Treat median values as medians, not averages.
- Do not calculate statewide totals by summing
  overlapping House and Senate geographies.
- Explain that ACS values are estimates.
- Poverty and unemployment rates are percentages.
- Income, home value, and rent are US dollars.
- Median household income is annual.
- Median gross rent is monthly.
- Bachelor's degree or higher refers to adults 25+.
- If the supplied data cannot answer a question,
  say what additional information is needed.
- Keep answers clear, useful, and reasonably concise.

DATA:
${JSON.stringify({ house, senate })}
`;

    const openAIResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          temperature: 0.1,
          max_completion_tokens: 1200,
          messages: [
            { role: "system", content: instructions },
            ...messages,
          ],
        }),
        signal: AbortSignal.timeout(60000),
      }
    );

    const result = await openAIResponse.json();

    if (!openAIResponse.ok) {
      console.error("OpenAI API error:", result);

      const code = result?.error?.code;

      const message =
        code === "insufficient_quota"
          ? "OpenAI API billing or credits are unavailable."
          : openAIResponse.status === 401
            ? "OpenAI API key was rejected."
            : `OpenAI request failed (${openAIResponse.status}).`;

      return NextResponse.json(
        { error: message },
        { status: 502 }
      );
    }

    const answer = result?.choices?.[0]?.message?.content;

    if (typeof answer !== "string" || !answer.trim()) {
      throw new Error("OpenAI returned an empty answer.");
    }

    return NextResponse.json({
      answer,
      reply: answer,
      response: answer,
      source: "U.S. Census Bureau",
      dataset: "2024 ACS 5-Year Estimates",
    });
  } catch (error) {
    console.error("Chat API error:", error);

    return NextResponse.json(
      { error: "Unable to generate an AI response. Check the server terminal." },
      { status: 500 }
    );
  }
}
