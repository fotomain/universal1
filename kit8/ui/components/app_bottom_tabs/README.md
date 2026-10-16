# ApplicationBottomTabsApp - `kit8/ui/components/app_bottom_tabs`

The bottom tab bar of the app. It works through **expo-router** (`router.push`, the active tab is read from `usePathname`) and takes its colors and shapes from the active **design system** (`WithDesignSystem`, like `FABApp`).

```tsx
<ApplicationBottomTabsApp tabsNavigatorName="tabsHome" />                   // the default tabs: Media · RACI · My · History
<ApplicationBottomTabsApp tabsArray={[{ tabIcon: 'home', tabTitle: 'Home', tabRoute: 'home' }]} />
```

| File | What |
|---|---|
| `ApplicationBottomTabsApp.tsx` | the component (used by `app/home/index.tsx`); `kit8/ui/components/navigation/BottomTabsRoutingComponent.tsx` re-exports it for old imports |
| `appBottomTabsModel.ts` | pure: `TabItem`, `tabHref` (route + query string), `isTabActive` (the path IS the route or lies inside it), `appBottomTabsLook(system)`, `withAlpha` |

## Look by design system (`appBottomTabsLook`)
| system | active mark | bar |
|---|---|---|
| paper · googlemd3web · expo | the MD3 pill behind the icon | surface, shadow |
| ant · tamagui | a line on the top edge of the tab | card |
| applemacui | none (the tint color) | translucent, hairline only |
| native (and any new system) | none | surface |

## The FAB stands above the bar (web and mobile)
While the bar is mounted it sets `uxuiState.bottomTabsAreVisible` (redux). `FABAppComponent` reads it and puts its container at `bottom = bar height + system inset + FAB_GAP` (`kit8/ui/components/navigation/bottomTabsLayout.ts`: `fabBottomOffset`); without the bar the FAB is at `inset + 24`. The bar leaves `BOTTOM_TABS_PADDING + inset` under the row, so the system bar (Android 3 buttons / gestures, the iPhone home indicator) never covers the labels.

## Tests
`__tests__/ui/appBottomTabsModel.test.ts` (pure) · `__tests__/ui/applicationBottomTabs.test.tsx` (the component: tabs, active tab, navigation, redux flag, design system look, inset) · `__tests__/navigation/bottomTabsLayout.test.ts` (the FAB offset).
