"use client";
import {useEffect,useState,type ReactNode} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import styles from "./WorkspaceShell.module.css";
import WorkspaceIcon,{type WorkspaceIconName} from "./WorkspaceIcon";

export type PageKey = "overview"|"map"|"initiatives"|"activity"|"partners"|"settings";
const menu:{href:string;label:string;icon:WorkspaceIconName;key:PageKey}[]=[
 {href:"/",label:"Overview",icon:"home",key:"overview"},
 {href:"/map",label:"Map View",icon:"map",key:"map"},
 {href:"/initiatives",label:"Opportunity Workspace",icon:"opportunity",key:"initiatives"},
 {href:"/activity",label:"Activity Center",icon:"activity",key:"activity"},
 {href:"/partners",label:"Partner Directory",icon:"partners",key:"partners"},
 {href:"/analytics",label:"Analytics Studio",icon:"analytics",key:"overview"},
 {href:"/outreach",label:"SNAP Data & Sources",icon:"sources",key:"overview"},
 {href:"/settings",label:"Settings",icon:"settings",key:"settings"}
];
export default function WorkspaceShell({children,title,kicker,actions}:{children:ReactNode;title:string;kicker?:string;actions?:ReactNode}){
 const pathname=usePathname();
 const [theme,setTheme]=useState<"day"|"night">("night");
 const [collapsed,setCollapsed]=useState(false);
 const [profile,setProfile]=useState<{name?:string;chamber?:string;district?:string}|null>(null);
 useEffect(()=>{try{
  setTheme(localStorage.getItem("gc-color-mode")==="day"?"day":"night");
  setCollapsed(localStorage.getItem("gc-nav-collapsed")==="1");
  setProfile(JSON.parse(localStorage.getItem("gc-demo-profile")||"null"));
 }catch{}},[]);
 const toggle=()=>setTheme(t=>{const n=t==="night"?"day":"night";try{localStorage.setItem("gc-color-mode",n);window.dispatchEvent(new CustomEvent("gc-theme-changed",{detail:n}))}catch{}return n});
 const sidebar=()=>setCollapsed(v=>{try{localStorage.setItem("gc-nav-collapsed",v?"0":"1")}catch{}return !v});
 return <div className={`${styles.shell} ${theme==="day"?styles.day:styles.night} ${collapsed?styles.collapsed:""}`}>
  <header className={styles.top}>
   <Link href="/" className={styles.brand}><span aria-hidden="true" className={styles.logo}>≋</span><span><strong>Going Concern</strong><small>CONSTITUENT INTELLIGENCE</small></span></Link>
   <nav className={styles.topnav} aria-label="Primary navigation"><Link href="/">District Intelligence</Link><Link href="/initiatives">Initiatives</Link><Link href="/partners">Partners</Link><Link href="/activity">Activity</Link><Link href="/analytics">Reports</Link></nav>
   <div className={styles.topright}><button type="button" onClick={toggle} aria-label={theme==="night"?"Switch to day mode":"Switch to night mode"}>{theme==="night"?"☀":"☾"}</button><span className={styles.avatar} title="Demonstration profile">{profile?.name?.trim()?.slice(0,2).toUpperCase()||"GC"}</span></div>
  </header>
  <aside className={styles.sidebar}>
   <div className={styles.location}>{!collapsed&&<><small>SELECTED DISTRICT</small><strong>{profile?.chamber||"House"} District {profile?.district||"1"}</strong></>}</div>
   <nav aria-label="Workspace navigation">{menu.map(m=><Link key={m.href} href={m.href} title={m.label} aria-current={pathname===m.href?"page":undefined}><WorkspaceIcon name={m.icon}/>{!collapsed&&<span>{m.label}</span>}</Link>)}</nav>
   <div className={styles.sidebottom}><button type="button" onClick={sidebar} aria-label={collapsed?"Expand navigation":"Collapse navigation"} aria-expanded={!collapsed}>{collapsed?"»":"« Collapse menu"}</button>{!collapsed&&<p>U.S. Census Bureau · ACS 5-Year<br/>Demo workspace · locally saved</p>}</div>
  </aside>
  <main className={styles.main}><div className={styles.heading}><div><small>{kicker||"GOING CONCERN / DISTRICT INTELLIGENCE"}</small><h1>{title}</h1></div>{actions&&<div className={styles.actions}>{actions}</div>}</div>{children}</main>
 </div>;
}