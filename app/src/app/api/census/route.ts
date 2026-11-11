import { NextRequest, NextResponse } from "next/server";


type Chamber = "House" | "Senate";
type District = {
  district: string;
  population: number | null;
  medianHouseholdIncome: number | null;
  povertyRate: number | null;
  unemploymentRate: number | null;
  medianHomeValue: number | null;
  medianGrossRent: number | null;
  bachelorsOrHigherRate: number | null;
};

const METRICS = [
  "population", "medianHouseholdIncome", "povertyRate", "unemploymentRate",
  "medianHomeValue", "medianGrossRent", "bachelorsOrHigherRate",
] as const;

function rankings(districts: District[]) {
  return Object.fromEntries(METRICS.map((metric) => {
    const valid = districts
      .filter((d) => typeof d[metric] === "number" && Number.isFinite(d[metric]))
      .sort((a, b) => (b[metric] as number) - (a[metric] as number));
    return [metric, { highestFive: valid.slice(0, 5).map((d) => ({ district: d.district, value: d[metric] })),
      lowestFive: valid.slice(-5).reverse().map((d) => ({ district: d.district, value: d[metric] })) }];
  }));
}

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is missing from app/.env.local." }, { status: 500 });
  }

  let body: { message?: unknown; history?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 1200) {
    return NextResponse.json({ error: "Enter a question up to 1,200 characters." }, { status: 400 });
  }

  const history = Array.isArray(body.history)
    ? body.history.slice(-6).filter((m): m is { role: "user" | "assistant"; content: string } =>
        !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.length <= 2000)
    : [];

  try {
    const datasets = await Promise.all((["House", "Senate"] as Chamber[]).map(async (chamber) => {
      const censusRequest = new NextRequest(new URL(`/api/census?chamber=${chamber}`, request.url));
      const result = await getCensus(censusRequest);
      if (!result.ok) throw new Error(`Census data unavailable for ${chamber}`);
      const data = await result.json();
      if (!Array.isArray(data.districts)) throw new Error(`Missing district data for ${chamber}`);
      const districts = data.districts as District[];
      return { chamber, districts, rankings: rankings(districts) };
    }));

    const instructions = [
      "You are the District Intelligence research assistant for Hawaiʻi legislative districts.",
      "Use ONLY the supplied 2024 ACS 5-Year Estimates dataset for numerical claims. Never invent values, sources, or causal explanations.",
      "Both House and Senate districts are supplied. Clearly identify chamber and district number.",
      "The rankings are precomputed from valid estimates; use them for top/bottom five questions.",
      "Rates are percentages. Income and home value are USD; gross rent is USD per month. Population is a count.",
      "For comparisons and rankings, quote relevant figures and distinguish observation from interpretation.",
      "If a question cannot be answered from these seven indicators, say so and explain what data is missing.",
      "These are survey estimates, not current live measurements. No margins of error are provided.",
      "Be concise and readable. Cite the source in the answer as U.S. Census Bureau, 2024 ACS 5-Year Estimates.",
      `Verified data: ${JSON.stringify(datasets)}`,
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        instructions,
        input: [...history, { role: "user", content: message }],
        max_output_tokens: 900,
        store: false,
      }),
      cache: "no-store",
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("OpenAI API error:", response.status, JSON.stringify(result).slice(0, 600));
      return NextResponse.json({ error: response.status === 429
        ? "API rate limit or billing limit reached. Check your OpenAI API billing."
        : "AI request failed. Check your API key, billing, and model access." }, { status: 502 });
    }

    const answer = Array.isArray(result.output)
      ? result.output.flatMap((item: { content?: { type?: string; text?: string }[] }) =>
          Array.isArray(item.content) ? item.content.filter((c) => c.type === "output_text").map((c) => c.text ?? "") : []).join("\n").trim()
      : "";
    if (!answer) return NextResponse.json({ error: "The model returned no text. Please retry." }, { status: 502 });
    return NextResponse.json({ answer, source: "U.S. Census Bureau, 2024 ACS 5-Year Estimates" });
  } catch (error) {
    console.error("AI Insights error:", error);
    return NextResponse.json({ error: "Unable to load Census data or contact the AI service." }, { status: 502 });
  }
}
