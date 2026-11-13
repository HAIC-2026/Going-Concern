import {NextRequest,NextResponse} from "next/server";

type District={chamber:"House"|"Senate";district:number;values:Record<string,number|null>};
type Metric={key:string;label:string;unit:string;source:string;note:string};
type Data={districts:District[];metrics:Metric[];limitations:string};
export async function POST(request:NextRequest){
 if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:"AI advisor is not configured. Add OPENAI_API_KEY to app/.env.local and restart the server."},{status:503});
 let input:unknown;
 try{input=await request.json()}catch{return NextResponse.json({error:"Invalid JSON"},{status:400})}
 if(!input||typeof input!=="object")return NextResponse.json({error:"Invalid request"},{status:400});
 const body=input as Record<string,unknown>;
 const chamber=body.chamber;
 const metricKey=body.metricKey;
 const scope=body.scope;
 const question=typeof body.question==="string"?body.question.trim().slice(0,500):"";
 const selected=Array.isArray(body.selected)?body.selected.filter((n):n is number=>Number.isInteger(n)&&n>0&&n<=51).slice(0,51):[];
 if((chamber!=="House"&&chamber!=="Senate")||typeof metricKey!=="string"||!question)return NextResponse.json({error:"Choose a chamber, metric, and question"},{status:400});
 try{
  const url=new URL(`/api/analytics?chamber=${chamber}`,request.url);
  const r=await fetch(url,{cache:"no-store"});
  if(!r.ok)throw new Error("Cannot load verified Census data");
  const data=await r.json() as Data;
  const metric=data.metrics.find(m=>m.key===metricKey);
  if(!metric)return NextResponse.json({error:"Metric not supported"},{status:400});
  const rows=(scope==="selected"?data.districts.filter(d=>selected.includes(d.district)):data.districts).map(d=>({district:d.district,value:d.values[metricKey]}));
  const valid=rows.filter(d=>typeof d.value==="number").sort((a,b)=>(b.value as number)-(a.value as number));
  const evidence={chamber,period:"2024 ACS five-year estimates",metric,rows,highest:valid.slice(0,5),lowest:valid.slice(-5),limitations:data.limitations};
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-4.1-mini",store:false,max_output_tokens:650,instructions:"You are an evidence-bound legislative district data analyst. Use only supplied district figures. Answer the user's question briefly, with comparisons when supported. Explain uncertainty. Do not claim causal effects, enrollment gaps, individual program eligibility, or trends: these are one 2024 ACS five-year dataset, NOT yearly observations. When proposing action, frame as an area to investigate rather than a verified unmet need. Cite the U.S. Census Bureau 2024 ACS 5-Year Estimates in prose. No invented percentages or figures.",input:[{role:"user",content:`Dataset: ${JSON.stringify(evidence)}\n\nQuestion: ${question}`}]}),cache:"no-store"});
  const result=await response.json();
  if(!response.ok)return NextResponse.json({error:response.status===429?"AI rate or billing limit reached":"AI analysis could not be completed"},{status:502});
  const answer=Array.isArray(result.output)?result.output.flatMap((part:{content?:{type?:string;text?:string}[]})=>Array.isArray(part.content)?part.content.filter(c=>c.type==="output_text").map(c=>c.text||""):[]).join("\n"):"";
  if(!answer)return NextResponse.json({error:"AI returned no analysis"},{status:502});
  return NextResponse.json({answer,source:"U.S. Census Bureau, 2024 ACS 5-Year Estimates"});
 }catch(error){console.error("Analytics insights",error);return NextResponse.json({error:"Unable to retrieve Census data or AI analysis"},{status:502})}
}
