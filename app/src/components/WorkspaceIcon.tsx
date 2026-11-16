import type {SVGProps} from "react";
export type WorkspaceIconName="home"|"map"|"opportunity"|"activity"|"partners"|"analytics"|"sources"|"settings"|"programs"|"outreach";
export default function WorkspaceIcon({name,...props}:SVGProps<SVGSVGElement>&{name:WorkspaceIconName}){
 const shared={fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const,strokeLinejoin:"round" as const};
 return <svg {...shared} {...props} width={props.width??21} height={props.height??21} viewBox="0 0 24 24" aria-hidden="true">
  {name==="home"&&<><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/><path d="M9 21v-8h6v8"/></>}
  {name==="map"&&<><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Z"/><path d="M9 3v16m6-14v16"/><circle cx="12" cy="12" r="2"/></>}
  {name==="opportunity"&&<><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12q9 6 18 0M11 13h2v3h-2z"/></>}
  {name==="activity"&&<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2M7 4l-2 2"/></>}
  {name==="partners"&&<><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 15a4 4 0 0 1 5 4v2"/></>}
  {name==="analytics"&&<><path d="M4 20V11m5 9V5m5 15v-8m5 8V3M2 20h20"/></>}
  {name==="sources"&&<><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 2 16 2 16 0V5M4 12v7c0 2 16 2 16 0v-7"/></>}
  {name==="programs"&&<><path d="M12 2.5 14.6 9.4 21.5 12l-6.9 2.6-2.6 6.9-2.6-6.9L2.5 12l6.9-2.6Z"/><path d="M19 3v4m-2-2h4"/></>}
  {name==="outreach"&&<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/><path d="m19 5 3-3"/></>}
  {name==="settings"&&<><circle cx="12" cy="12" r="3"/><path d="m10 2-.5 2-2 1-2-.5-2 3 1.5 1.5v3L3.5 14l2 3 2-.5 2 1 .5 2h4l.5-2 2-1 2 .5 2-3-1.5-2v-2L20.5 8l-2-3-2 .5-2-1L14 2z"/></>}
 </svg>;
}
