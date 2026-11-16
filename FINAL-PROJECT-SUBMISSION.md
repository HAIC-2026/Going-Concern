# Final Project Submission: Going Concern — Know Your District

**Project format:** HAIC-related server-based web application prototype  
**Team:** Going Concern (solo)  
**Date:** November 16, 2026  
**Code:** https://github.com/HAIC-2026/Going-Concern/tree/fix/compact-map-filters-scale  
**Status:** Local demonstration prototype; not a deployed or production-ready service

## Project overview

Going Concern is a prototype web application developed for the HAIC 2026 "Know Your District" challenge. Its goal is to help Hawaiʻi legislative offices explore publicly available socioeconomic data, recognize areas of potential need, and plan outreach around existing government assistance programs. It covers the state's **51 House** and **25 Senate** legislative districts.

This is a proof of concept, not a tool that identifies individual residents, makes eligibility decisions, contacts people automatically, or proves that an outreach campaign has improved enrollment.

## What the current prototype actually does

- Displays district-level demographic and socioeconomic estimates from the U.S. Census Bureau's American Community Survey (ACS).
- Provides a geographic map of Hawaiʻi legislative districts and several selectable map indicators, using state GIS boundaries and Leaflet.
- Offers an Analytics Studio for visual comparison of selected district indicators.
- Presents one more developed case study: **SNAP outreach screening** using ACS five-year subject table **S2201**. It displays estimated households *below the poverty level* that are **not receiving SNAP**, along with estimated participation rates, county/state comparisons, published margins of error, and a simple matching-rate what-if calculation. This count is **not** a verified number of SNAP-eligible nonparticipants.
- Includes a demonstration Opportunity Workspace in which a user can create a draft initiative, record notes, select potential partner resources, draft (but **not send**) an email, and save activity in their browser. This is not a live case-management or outreach system.
- Can print or export some analytical views or draft data.

For one checked example, the downloaded **2024 ACS S2201** cache reports **540 ± 177** below-poverty households not receiving SNAP in **House District 5** (90% confidence margin of error). The testing script compared the saved source estimates with the Census API. Estimates remain subject to sampling uncertainty and do not establish eligibility.

## Server-related architecture

- **Client / UI:** React, TypeScript, and Next.js 16 (App Router).
- **Application server:** Next.js API route handlers retrieve and prepare publicly available data for browser views (including census, analytics, and outreach endpoints).
- **External data:** U.S. Census Bureau ACS API and State of Hawaiʻi GIS services.
- **Data caching:** The SNAP case study includes a locally cached JSON snapshot of 2024 ACS five-year S2201 data for all 76 districts, reducing dependence on a live Census API during the demo.
- **Mapping:** Leaflet / React Leaflet renders district geometry and geographic layers in the browser.
- **Development and version control:** Node.js, npm, Git, and GitHub. Local development runs at http://localhost:3000.

The prototype illustrates the flow **browser -> Next.js server route -> public data source or verified cache -> analyzed response -> visualization**.

## Server security and limitations

The project primarily uses **aggregated public statistics**, not personal constituent records. API keys must be stored in environment variables rather than committed to GitHub. The login is a **simulated demonstration screen**, not real authentication or authorization. Initiative drafts and activity history are saved in local browser storage, not to a secure multiuser database. There is no implemented email-sending service or confirmation of agency partnerships. The AI-related demonstration features should not be treated as authoritative eligibility or outreach decisions.

The prototype currently runs **locally** and is **not publicly deployed**. Map tiles and some source queries may require an internet connection. The proposed Med-QUEST enrollment gap, full program eligibility models, longitudinal analysis, production identity management, and multiuser workflows are **not implemented**.

## Validation, code, and how to run

From the repository root on Windows with Node.js installed:

```powershell
cd app
npm.cmd install
npm.cmd run build
npm.cmd run dev
```

Open http://localhost:3000. To validate a cached SNAP estimate against the live API:

```powershell
node scripts/test-outreach.mjs House 5
```

The 2024 ACS cached data is in `app/src/data/outreach-cache.json`; project setup and methods are further documented in the repository's `README.md`.

## Intended future development

Future versions would consolidate a reliable evidence-to-action workflow: more verified program measures and uncertainty estimates, clearer district-to-county matching, accessible visualizations, secure agency accounts, documented partner coordination, and measurable outreach outcomes. These are project goals, **not capabilities claimed for this submission**.

## Presentation

A narrated website walkthrough will be recorded separately. It will explain the problem, the server/data architecture, the currently working demonstration, and the limitations.

---

**Academic integrity note:** This project summary distinguishes implemented prototype features from proposed future functionality. The author's demonstration and code should be evaluated as a learning project, not a finished government product.
