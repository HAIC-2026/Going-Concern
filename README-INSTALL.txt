GOING CONCERN - PROGRAM DISCOVERY INCREMENT

Includes FOUR NEW FILES ONLY:
app/src/data/programs.json
app/src/lib/programMatching.ts
app/src/app/api/programs/route.ts
app/src/app/programs/page.tsx

HOW TO INSTALL
1. Save this ZIP on your Windows computer.
2. Open it using Windows Explorer (Extract All) into a temporary folder.
3. Copy the 'app' folder from inside the extracted patch into the Going-Concern repository ROOT (C:\Users\tyler\Projects\Going-Concern). Choose MERGE folders. No pre-existing source files should be overwritten.
4. Open VS Code terminal at C:\Users\tyler\Projects\Going-Concern\app.
5. Run npm.cmd run dev (if not already running).
6. Open http://localhost:3000/programs
7. Try House district 13 and Senate district 23 and confirm official links and indicator evidence. Also verify existing homepage and AI remain functional.
8. Run npm.cmd run build in a second terminal (if Next dev server causes lock issue, stop dev first).
9. Commit ONLY after tests pass: git add src/data/programs.json src/lib/programMatching.ts src/app/api/programs/route.ts src/app/programs/page.tsx; git commit -m "feat: add district program discovery"; git push origin main

LIMITS
Program suggestions use simple same-chamber relative economic-indicator screening. This is NOT eligibility, a beneficiary count, or an estimated enrollment gap. Age-specific matching is deliberately not yet enabled until suitable Census indicators are available.
No pre-existing files were edited. The new route is accessible at /programs; a navigation link can be added in a subsequent UI change.
