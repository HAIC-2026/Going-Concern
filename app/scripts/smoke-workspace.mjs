// Run from app/ after npm run dev: node scripts/smoke-workspace.mjs
// Reports unexpected route errors without claiming that browser interactions are tested.
const base=process.env.GC_BASE_URL||"http://localhost:3000";
const paths=["/","/map","/initiatives","/activity","/partners","/settings","/analytics","/outreach","/programs","/api/outreach?chamber=House"];
let errors=0;
for(const path of paths){
 try{const r=await fetch(base+path,{signal:AbortSignal.timeout(12000)});
  let note="";
  if(path.startsWith("/api/outreach")&&r.ok){const data=await r.json();note=`districts=${data.districts?.length??"?"}, vintage=${data.vintage??"?"}`;if(data.districts?.length!==51)errors++;}
  if(!r.ok)errors++;
  console.log((r.ok?"PASS":"FAIL"),r.status,path,note);
 }catch(e){errors++;console.error("FAIL",path,String(e))}
}
if(errors){console.error(`FAILED checks: ${errors}`);process.exitCode=1}else console.log("PASS: HTTP routing and SNAP API smoke checks. Manually verify visuals, map controls, session login and local draft storage.");
