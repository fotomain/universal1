# Route visits - `kit8/catalog/user/visit`

How often the signed-in user opened each screen. Table `app_route_visits_turnover` (SQL: PART 41 of `start1_sql_tables.sql` + `start2_sql_code.sql`), the generic layout: **rowOwnerGUID = the GUID of the user · rowParentGUID = the route** (`/catalog/money/account`; a GUID inside a path is written `:id`) **· rowJSON `{ number_of_route_visits, last_visit_at }`**. ONE row per user and route (unique index).

* **Switch** `numberOfVisitsFunctionalityEnabled` in the Organization (`organizationTable.rowJSON`; Organization edit → tab **System** → *Number of visits*). **TRUE by default** - only a stored `false` stops the counting. The database checks it too (`route_visits_enabled()`), so a stale client cannot count either. The client reads it with `useMyOrganization().numberOfVisitsEnabled` (cached 15 s; a change is seen on the next focus / reload).
* **Counting**: `RouteVisitTracker` (mounted once in `app/_layout.tsx`) → `useRouteVisitTracker` calls the RPC `route_visit_register(route)` on every route change (+1; the root `/` is not counted; waits for the organization to be read; idle while signed out). A client cannot INSERT / UPDATE the table - only the RPC writes it.
* **Screen** `/user/visits` (Drawer: **System settings → Routes visits**) → `RouteVisitsCRUD.tsx`: a `ReusableTable` (Route · Visits · Last visit), read only, no add; the crud panel deletes the checked rows. **Clear** (icon in the header, asks first) calls `route_visits_clear()` = deletes ALL rows of the user (`rowOwnerGUID` = his GUID); `route_visits_clear(route)` deletes one route.
* **Top 5** in the pinned part of the hamburger menu (`kit8/ui/components/HamburgerMenuUnmovable.tsx`): `RouteVisitsTop` shows the 5 most visited routes (route + count, nothing else; a press opens the route). Hidden while signed out, while the switch is off and while there is no visit. `topRouteVisits` sorts by visits, ties by route.
* RLS: a user reads and deletes only his own rows. Realtime is on (the Top 5 follows).

| File | What |
|---|---|
| `routeVisitModel.ts` | table, switch key, `normalizeRoute`, `topRouteVisits`, `formatLastVisit` (pure) |
| `routeVisitMetaData.ts` | SystemMetaData entry (`routeVisitReusable`) |
| `useRouteVisitData.ts` | the rows from redux (read + realtime) |
| `useRouteVisitTracker.ts` · `RouteVisitTracker.tsx` | the counting |
| `RouteVisitsCRUD.tsx` · `RouteVisitsTop.tsx` | the screen · the Top 5 |

Tests: `__tests__/catalog/user/visit`, `__tests__/drawer-catalogs.test.tsx`, Docker `./test_fact_monitor01.sh 99`.
