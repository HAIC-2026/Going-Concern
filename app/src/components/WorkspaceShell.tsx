"use client";
import {useEffect,useState,type ReactNode} from "react";
import Link from "next/link";
import {usePathname,useRouter} from "next/navigation";
import styles from "./WorkspaceShell.module.css";
import WorkspaceIcon,{type WorkspaceIconName} from "./WorkspaceIcon";

const menu:{href:string;label:string;icon:WorkspaceIconName}[]=[
 {href:"/",label:"Home",icon:"home"},
 {href:"/map",label:"Map View",icon:"map"},
 {href:"/initiatives",label:"Opportunity Workspace",icon:"opportunity"},
 {href:"/activity",label:"Activity Center",icon:"activity"},
 {href:"/partners",label:"Partner Directory",icon:"partners"},
 {href:"/settings",label:"Settings",icon:"settings"},
 {href:"/programs",label:"Program Discovery",icon:"programs"},
 {href:"/outreach",label:"Outreach Gap",icon:"outreach"},
 {href:"/analytics",label:"Analytics Studio",icon:"analytics"}
];

type Props={children:ReactNode;title:string;kicker?:string;actions?:ReactNode;mapMode?:boolean;hideHeading?:boolean};
export default function WorkspaceShell({children,title,kicker,actions,mapMode=false,hideHeading=false}:Props){
 const pathname=usePathname();
 const router=useRouter();
 const [theme,setTheme]=useState<"day"|"night">("day");
 const [collapsed,setCollapsed]=useState(false);
 const [profile,setProfile]=useState<{name?:string;chamber?:string;district?:string}|null>(null);
 useEffect(()=>{
  const sync=()=>{try{
    setTheme(localStorage.getItem("gc-color-mode")==="night"?"night":"day");
    setCollapsed(localStorage.getItem("gc-nav-collapsed")==="1");
    setProfile(JSON.parse(localStorage.getItem("gc-demo-profile")||"null"));
  }catch{}};
  const themeChange=(event:Event)=>{const next=(event as CustomEvent<"day"|"night">).detail;if(next==="day"||next==="night")setTheme(next)};
  sync();
  window.addEventListener("storage",sync);
  window.addEventListener("gc-theme-changed",themeChange);
  return ()=>{window.removeEventListener("storage",sync);window.removeEventListener("gc-theme-changed",themeChange)};
 },[]);
 const toggleTheme=()=>{
  const next=theme==="day"?"night":"day";setTheme(next);
  try{localStorage.setItem("gc-color-mode",next);window.dispatchEvent(new CustomEvent("gc-theme-changed",{detail:next}))}catch{}
 };
 const toggleSidebar=()=>{const next=!collapsed;setCollapsed(next);try{localStorage.setItem("gc-nav-collapsed",next?"1":"0")}catch{}};
 const switchProfile=()=>{
  try{sessionStorage.setItem("gc-open-profile","1")}catch{}
  if(pathname==="/")window.dispatchEvent(new Event("gc-open-profile"));
  else router.push("/");
 };
 return <div className={`${styles.shell} ${theme==="night"?styles.night:styles.day} ${collapsed?styles.collapsed:""} ${mapMode?styles.mapMode:""}`}>
  <aside className={styles.sidebar} aria-label="Workspace sidebar">
   <button type="button" className={styles.collapseHandle} onClick={toggleSidebar}
    aria-expanded={!collapsed} aria-label={collapsed?"Expand sidebar":"Collapse sidebar"} title={collapsed?"Expand sidebar":"Collapse sidebar"}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
     <rect x="3" y="4" width="18" height="16" rx="2.5"/>
     <path d="M9 4v16"/>
     {collapsed ? <path d="m13 9 3 3-3 3"/> : <path d="m16 9-3 3 3 3"/>}
    </svg>
   </button>
   {!collapsed&&<div className={styles.islands} aria-hidden="true"/>}
   <nav className={styles.nav} aria-label="Main navigation">
    {menu.map(item=><Link key={item.href} href={item.href} title={item.label}
      aria-current={pathname===item.href?"page":undefined}>
      <WorkspaceIcon name={item.icon}/>{!collapsed&&<span>{item.label}</span>}
     </Link>)}
   </nav>
   <div className={styles.sidebarBottom}>
    {!collapsed&&<>
     <button className={styles.profile} onClick={switchProfile} type="button">
      <WorkspaceIcon name="home"/> <span>Switch Profile</span>
     </button>
     <div className={styles.sources}><strong>DATA SOURCES</strong><span>State of Hawaiʻi GIS</span><span>U.S. Census Bureau</span><span>2024 ACS 5-Year</span></div>
    </>}
    <button className={styles.themeSwitch} onClick={toggleTheme} type="button"
     aria-label={theme==="night"?"Switch to day mode":"Switch to evening mode"} title={theme==="night"?"Day mode":"Evening mode"}>
      <span aria-hidden="true">{theme==="night"?"☀":"☾"}</span>{!collapsed&&<span className={styles.themeTrack}><span/></span>}
    </button>
   </div>
  </aside>
  <main className={styles.main}>
   {!mapMode&&!hideHeading&&<div className={styles.heading}>
     <div>{kicker&&<small>{kicker}</small>}<h1>{title}</h1></div>
     {actions&&<div className={styles.actions}>{actions}</div>}
    </div>}
   {children}
  </main>
 </div>;
}
