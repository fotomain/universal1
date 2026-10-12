# Pie chart (`kit8/bi/chart/pie`)

`PieChartReusable` - a Skia pie chart + legend for any rows `{ key, label, value }` (web, iOS, Android).

    import { PieChartReusable } from 'kit8/bi/chart/pie';
    <PieChartReusable data={rows} size={220} gapColor={palette.background} textColor={palette.text} mutedColor={palette.textMuted} />

| File | What |
|---|---|
| `pieChartModel.ts` | pure: `buildPieSlices` (rows with a value > 0, biggest first, beyond `maxSlices` (8) the smallest are added up into "Other"; angles clockwise from 12 o'clock), `formatPiePercent`, `PIE_COLORS` (slate blue, orange, green, yellow, ...) |
| `PieChartReusable.tsx` | the Skia canvas (one filled path per slice, a `gapColor` line between slices) and the legend (color dot, label, percent) |
| `index.ts` | exports |

Used by the Reports view (`kit8/pm/view/reports/PMProjectReportsView.tsx`): every table (By kind, By budget item, By task) takes the left 50% of the width, its pie the right 50% (stacked on a narrow screen).
Colors are props, the component knows nothing about projects. Tests: `__tests__/bi/chart/pie`.
