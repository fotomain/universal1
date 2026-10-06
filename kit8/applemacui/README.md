# kit8/applemacui — Apple Mac UI design system (iOS look and feel on iOS / Android / web)

Seventh design system of the app: `activeSystem === 'applemacui'` (3rd in the list at `/settings`). Demo: `/kit8/applemacui`
(every component, light and dark side by side). Brief: Google doc "W1 APPLE UI".

## Architecture

```
kit8/applemacui/
  appleMacUITheme.ts          tokens (pure data): colors light + dark, radii, 4 pt spacing, sizes, iOS type scale, font, motion
  WithAppleMacUI.tsx          <WithAppleMacUI theme={appleMacUITheme}> provider + useAppleMacUI() → { theme, text(style), reduceMotion }
  lib/usePressSpring.ts    press feedback: spring scale 0.97 + opacity on the UI thread (Reanimated)
  lib/haptics.ts           light tap / selection haptics on iOS (expo-haptics)
  components/              one file per component, typed props
  AppleMacUIDemoScreen.tsx    demo (route app/kit8/applemacui)
tamagui.config.ts          themes apple_light / apple_dark + tokens appleColor / appleRadius / appleSpace / appleSize / appleFont
kit8/providers/WithDesignSystem.tsx   + 'applemacui', appleMacUITheme, isAppleMacUI; themeColors = iOS system colors while it is active
app/_layout.tsx            <PaperProvider theme={paperTheme}><WithAppleMacUI theme={appleMacUITheme}>…
```

Dark / light: `WithAppleMacUI` follows the app's dark mode (WithDesignSystem); `mode="system"` follows the OS setting;
`mode="light" | "dark"` forces one. `tint` overrides the accent (systemBlue).

## Tokens

| group | values |
|---|---|
| colors | systemBlue #007AFF (dark #0A84FF) · systemGreen #34C759 · systemRed #FF3B30 · systemOrange · systemYellow · systemGray…6 · label / secondaryLabel / tertiaryLabel / placeholderText · systemBackground / secondary… / tertiary… · systemGroupedBackground / secondarySystemGroupedBackground · separator / opaqueSeparator · fill / secondaryFill / tertiaryFill |
| radii | input 10 · button 12 (small 12, large 14) · card 12 · sheet 20 |
| space | 4 pt grid: 0 4 8 12 16 20 24 32 40 |
| size | touch target 44 · controls 32 / 44 / 50 · list row 44 · switch 51 × 31 (thumb 27) · segmented 32 · grabber 36 × 5 |
| type | Large Title 34 · Title 1 28 · Title 2 22 · Title 3 20 · Headline 17 semibold · Body 17 · Callout 16 · Subhead 15 · Footnote 13 · Caption 12 / 11 |
| font | web: -apple-system, SF Pro …; iOS: system (SF); Android: Roboto |

## Components

| component | API | platforms |
|---|---|---|
| `AppleButton` | `variant` filled · tinted · gray · plain; `size` small · medium · large; `loading`, `disabled`, `destructive`, `icon`, `fullWidth`, `haptics` | one file; haptics iOS only; focus ring web only |
| `AppleTextField` | `label`, `placeholder`, `error`, `helperText`, `clearButton`, `secureTextEntry` (+ show / hide), `keyboardType`, `variant` default · grouped, `left` / `right`, `multiline` | one file; focus ring = tint border (+ soft outer ring on web) |
| `AppleDatePicker` | `value`, `onChange`, `mode` date · time · datetime, `min`, `max`, `label` | `.web.tsx` = styled `<input type=date/time/datetime-local>`; `.tsx` (iOS / Android) = field + react-native-paper-dates modals (see limitations) |
| `AppleSegmentedControl` | `value`, `onValueChange`, `segments[{ value, label, icon?, disabled? }]` | one file; sliding selection |
| `AppleSwitch` | `value`, `onValueChange`, `label`, `disabled`, `color` | one file |
| `AppleGroupedList` / `AppleListRow` | list: `header`, `footer`, `inset`; row: `title`, `subtitle`, `value`, `icon`, `accessory` chevron · check · none, `right`, `destructive`, `onPress` | one file |
| `AppleSheet` | `visible`, `onClose`, `title`, `detents` medium · large, `initialDetent`, `dismissible` | one file; grabber drag via gesture-handler |
| `AppleNavigationBar` | `title`, `large`, `left`, `right` | expo-blur on native, `backdrop-filter` on web |

## The app's components in AppleMacUI (`kit8/components/common`)

`ButtonApp` → AppleButton (contained = filled, outlined = tinted, text = plain) · `TextInputApp`, `TextAreaApp` →
AppleTextField · `SwitchApp` → AppleSwitch · `SegmentButtonsApp` → AppleSegmentedControl · `CardApp` → inset grouped
card · `TextApp` → iOS text styles · `DateInputApp`, `NumberStepperInputApp` → the Apple field look.
`FABApp`, `SelectorFromApp`, `ModalAskComponent`, `SearchTextApp`, `SnackbarApp` have no Apple variant yet: they use
their default look with the iOS colors.

## Accessibility

Roles / labels / states on every control (`aria-*` too, react-native-web ignores `accessibilityState`), Dynamic Type
(`allowFontScaling`), 44 pt touch targets (hit slop on the 32 pt button, the switch and the segmented control), reduced
motion (springs become instant), visible focus on web, label contrast ≥ 4.5:1 (tested).

## Verified

Jest (jsdom + react-native-web): `npx jest __tests__/applemacui` - tokens, provider, every component's states, the demo.
NOT verified on an iOS / Android device or in a browser by hand: haptics, blur, the sheet's drag and the native date
modals have only been type-checked and unit-tested.

## Setup

No new packages: Expo 57, Reanimated 4, gesture-handler, expo-haptics, expo-blur and react-native-paper-dates were
already in the project. Nothing to install; no new dev build is needed for this version.

## Known limitations / open decisions

* **Native date pickers.** The brief names `@react-native-community/datetimepicker` (iOS wheel / compact) and
  `react-native-date-picker` (Android wheel). Neither is installed; adding them changes the stack and needs a new dev
  build (not Expo Go), so iOS / Android use the react-native-paper-dates modals (Material look) behind the same API.
  Only `components/AppleDatePicker.tsx` changes when the packages are added.
* **Tamagui.** `tamagui.config.ts` in this app is a plain token object (no `createTamagui`, no compiler); the Apple
  tokens are published there, the components are React Native `StyleSheet` + Reanimated and read the tokens through
  `useAppleMacUI()`. Moving to real Tamagui v2 styled components + the web compiler is a stack change.
* **HIG reference text** (Tip 1 of the brief) was not pasted in: the components follow the HIG specs from the
  assistant's knowledge (system colors, Dynamic Type sizes, 44 pt targets, control metrics), not from the live pages.
* No Liquid Glass materials; continuous ("squircle") corners are approximated with plain radii; no large-content
  viewer; RTL not checked.
* Tests use the project's jsdom / react-dom harness (the same as `__tests__/pm/ui`), not React Native Testing Library.
