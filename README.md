# Know Your District — HAIC 2026
Team: **Going Concern**

A Next.js/React/TypeScript district intelligence prototype for Hawaiʻi's 51 House and 25 Senate districts. The working application includes the Diamond Head day/night Home dashboard, Leaflet Map View, Program Discovery, Analytics Studio, and the **Outreach Gap** SNAP analysis at `/outreach`.

## Getting started (Windows 11)

```powershell
cd app
npm.cmd install
npm.cmd run dev
```

Visit `http://localhost:3000/outreach`. Before the technical review, refresh and **commit the offline cache**:

```powershell
# In app/; optionally set the Census API key in your terminal/session:
# $env:CENSUS_API_KEY="your-key"
node scripts/refresh-outreach.mjs
node scripts/test-outreach.mjs House 5
npm.cmd run build
```

Run `git status`, review `app/src/data/outreach-cache.json`, and commit only after checking it. **The cache is crucial for reliable judging**: until generated and committed, `/api/outreach` calls Census live, which can be slow/unavailable. On the deployment host, the generated snapshot is read from disk first. Refreshing the cache requires network access and should be done before submission. The dashboard shows the ACS vintage and snapshot timestamp.

## Environment variables

- `CENSUS_API_KEY`: Census API key recommended for snapshot refresh; keep in `app/.env.local` or terminal, never commit. On the web server it is optional while serving a validated cache.
- `OPENAI_API_KEY`: used by existing general chat/analytics AI features; not required for SNAP Outreach Gap, which provides deterministic explanations from computed values.
- Both keys are secrets. Never copy them into the browser, public JSON, or Git.

## SNAP outreach metric

**Source:** U.S. Census Bureau, latest *published* ACS five-year **subject** table `S2201`. The refresh script checks the official Census table metadata before selecting the vintage. Table fields:

| Quantity | Estimate | Published 90% margin of error |
| --- | --- | --- |
| Households below poverty | `S2201_C01_021E` | `S2201_C01_021M` |
| Below-poverty households receiving SNAP | `S2201_C03_021E` | `S2201_C03_021M` |
| Below-poverty households not receiving SNAP | `S2201_C05_021E` | `S2201_C05_021M` |

Published nonrecipient **count** is the centerpiece. It is **not** a confirmed count of eligible nonparticipants; poverty status is a proxy and SNAP eligibility depends on more criteria. This is a population-level screen, never individual eligibility or enrollment evidence.

Participation rate (derived): `100 × receiving below-poverty households / all below-poverty households`.

**Margin of error:** For published estimates, display the Census 90%-confidence MOE directly. For subset ratio estimate `r=n/d`, approximate 90% percentage-point MOE as `100 × sqrt(MOE_n² − (n/d)² × MOE_d²) / d`; when the radicand is negative use the general-ratio approximation replacing subtraction with addition. This follows the Census ACS Handbook approach, assuming the numerator is included in the denominator. Comparisons across overlapping geographies are *descriptive*, not tests of significance.

**CV:** `CV = (published_or_derived_MOE / 1.645) / estimate`. Any value with CV over 0.30 has a prominent high-uncertainty flag. Suppressed/missing estimates or MOEs are shown as not available, not inferred.

**What-if:** `max(0, round(below-poverty households × (county or state rate − district rate) / 100))`. The page shows the formula, denominator, rates, each published/derived MOE, Census source lines, and whether the district is already at/above the comparison. It is not a forecast and cannot be interpreted as the effect of outreach. Because district rates are correlated with county/state rates, we do not present an unjustified precise confidence interval for the scenario.

## Geographic comparison

- State FIPS: `15`; county FIPS: `001` Hawaiʻi, `003` Honolulu, `005` Kalawao, `007` Kauaʻi, `009` Maui. The state has **five** Census counties; some sources display only the four large administrative counties.
- ACS 2024+ legislative district geography references the **2022 post-reapportionment district geography**. The refresh checks that 51 lower-chamber and 25 upper-chamber rows are returned. The Office of Elections provides the authoritative 2022 election maps and legislative district descriptions.
- Documented district-to-county mapping from the Office of Elections:
  - House 1–8 Hawaiʻi County, 9–14 Maui County, 15–17 Kauaʻi County, 18–51 Honolulu County.
  - Senate 1–4 Hawaiʻi County, 5–7 Maui County, 8 Kauaʻi County, 9–25 Honolulu County.
- Reference: https://elections.hawaii.gov/final-2021-reapportionment-plans-metes-and-bounds/ and https://elections.hawaii.gov/resources/maps/election-maps/. **Kalawao County on Molokaʻi is a fifth Census county**. House District 13 and Senate District 7 are associated with *Maui County* for this simple comparison, even though portions may overlap Kalawao; this is a primary-county, not exact polygon-intersection, crosswalk. Cross-county analysis should use official GIS polygons and a documented population-weighted match before drawing precise geographic conclusions.

## Data validation

`node scripts/test-outreach.mjs House 5` checks the cached district's three S2201 counts against a **fresh raw Census API response**, checks the expected 76 district rows, and checks total ≈ recipients + nonrecipients (allowing two-household rounding tolerance). The test reports derived participation and CV. Test another district using `Senate 8`, etc.

## Program sources

- Hawaiʻi DHS SNAP: https://humanservices.hawaii.gov/bessd/snap./
- Med-QUEST: https://medquest.hawaii.gov/

**The administering agency alone determines individual eligibility.** The app provides information, not case records or benefits decisions.

## Known limitations and deliberate scope

- SNAP is implemented **first** in the new Outreach Gap page. The proposed uninsured-under-138%-of-poverty Med-QUEST proxy is **not yet implemented**: a joint income × health-insurance estimate with defensible numerator/MOE has to be independently verified.
- Remaining requested profile cards (S0101, S1701, S2101, B25070) require additional verified source integration with published MOEs and are not displayed as if complete.
- The current Analytics Studio has additional 2024 indicators; some lack propagated MOEs and should not be used to infer statistically meaningful changes.
- The ACS five-year dataset does **not** provide annual trends just because it covers five years. No fabricated trends or eligibility counts.
- Some district values may be missing or high-uncertainty. These cases are marked instead of estimated.
- This version exports a one-pager through **browser Print / Save as PDF**; no server-side PDF generation.
- This feature's interpretation is deterministic, source-bound, and nonpartisan. Existing general chat endpoints are separate; do **not** use them as authoritative sources for the SNAP gap.

## Deployment checklist for technical review

1. Generate and verify `app/src/data/outreach-cache.json` while connected to Census; commit it.
2. Run `npm.cmd run build`; inspect `/outreach`, both chambers, district selection, high-CV flags, county/state switch, and Print to PDF.
3. Confirm cache-backed service works even if Census temporarily fails.
4. Deploy the verified commit before **Monday, November 16, 2026, 9:00 a.m. HST**.

## Competition workspace redesign (demonstration branch)

The `feature/competition-workspace` branch adds a consistent floating Hawaiian day/night navigation shell for new routes and a demonstration initiative workflow. Routes:

- `/`: existing Home/overview with persistent session sign-in and updated navigation.
- `/map`: interactive split map, expandable filters, House/Senate boundaries, day/night tile maps and Census geographic layers. Public geospatial tiles and Hawaiʻi GIS boundaries still require network access.
- `/initiatives`: SNAP Opportunity Workspace with verified `/api/outreach` comparisons, user-controlled Discover → Verify → Match → Plan → Outreach → Track stages, a clickable data-to-action flow, local draft notes and email, partner selection, export of source-backed JSON and browser printing.
- `/activity`: actions actually performed in the local demonstration browser (not fictitious approvals, sent emails or outcomes).
- `/partners`: official resources and possible partner organizations. Listed organizations have not agreed to partner with Going Concern.
- `/settings`: demo storage and browser appearance controls.
- `/analytics`, `/outreach`, and `/programs`: existing analytics, Census methodology and program explorer preserved; these legacy pages have their original UI pending full visual migration.

**Persistence:** Demo sign-in is stored in the current browser's `sessionStorage` and remains active across page navigation. A demo profile, theme, navigation state and editable initiative drafts use browser `localStorage`. No cloud database, multi-user approval system, official authorization or actual email-sending is implemented.

**Source integrity:** the proposed SNAP flow always uses actual cached or live S2201 estimates from `/api/outreach`. No hard-coded example gap quantities, enrollment claims or success percentages. Its scenario is arithmetic using county/state comparator rates, not a forecast. All programme decisions remain with administrators.

**Production deployment:** this feature branch is not automatically safe to merge. Run `npm.cmd run build`, then exercise profile persistence, all navigation links, the map in both themes, the district selection, initiative creation, local activity updates, and print/export. Commit `app/src/data/outreach-cache.json` and keep API keys in environment variables. Deploy a **tested** version with Vercel Root Directory `app`, not the repository root. Public access is required for technical review.

## Single-sidebar visual layout (fix/single-sidebar-layout)

All main navigation routes use the approved Home design: **no horizontal top application header**, the same `gc-diamondhead-day.png` background by day and `gc-diamondhead-evening.png` by night, a floating left glass sidebar, the island-chain artwork, and a **single sidebar collapse toggle at the upper-right**. The previous bottom-of-sidebar collapse button is removed. Theme, collapse preference, and demo profile are saved in browser storage.

Map View (`/map`) is the one background exception: the Leaflet map fills the entire viewport behind the glass sidebar, while filters float on the left side of the map. Day/night basemap controls remain functional.

Home, Analytics Studio, Outreach Gap, and Program Discovery use Next.js client-side links. Individual routes still exist for bookmarking, navigation history, and browser back/forward; **this is not a production authentication system**. Changes on this branch require a successful `npm run build` and visual verification on desktop and mobile before deployment.
