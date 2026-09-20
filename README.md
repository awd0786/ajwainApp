# Sprint Dashboard — Expo Mobile App

React Native (Expo) port of the web Login + Sprint Dashboard pages.

## 1. Install & run

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** (iOS/Android), or press `a` / `i` for an emulator.

## 2. Point the app at your API — one file to edit

**`src/api/config.js`** is the single source of truth for the backend URL and every
endpoint path. Every screen imports from here — nothing else hardcodes a URL.

```js
export const BASE_URL = 'http://192.168.1.50:5000/api';
```

- Physical phone on the same Wi-Fi → use your dev machine's LAN IP.
- Android emulator → `http://10.0.2.2:5000/api`.
- iOS simulator → `http://localhost:5000/api` works.

If a new endpoint is ever added to the API, add one line to `ENDPOINTS` in that
file and call it via `apiUrl('yourKey', { param: value })` everywhere else.

## 3. Project structure

```
App.js                          entry point
src/
  api/
    config.js                   BASE_URL + ENDPOINTS + apiUrl() — edit this for your server
    authFetch.js                fetch wrapper that attaches the bearer token
  context/
    AuthContext.js              login/logout/session state (replaces sessionStorage reads)
  utils/
    storage.js                  AsyncStorage helpers (mobile's sessionStorage)
    format.js                   date/ageing/status helpers ported from the web app
  theme/
    theme.js                    colors, spacing, radii, status color map
  components/
    FilterSheet.js              searchable slide-up picker (replaces Group/Product/Sprint/Client/Status dropdowns)
    RecordCard.js                mobile card for one sprint point (replaces a table row)
    StatusChartModal.js         animated status breakdown chart (replaces ChartModal)
    ActionSheet.js              long-press action sheet (replaces right-click ContextMenu)
    Badge.js                    status pill
  navigation/
    AppNavigator.js             switches Login <-> SprintDashboard based on auth state
  screens/
    LoginScreen.js
    SprintDashboardScreen.js
```

## 4. What changed vs. the web version (and why)

Mobile has no mouse, no `window`/`sessionStorage`, no `createPortal`, and a much
narrower screen, so the same data/behavior is presented differently:

- **`sessionStorage` → `AsyncStorage`** via `src/utils/storage.js`.
- **Wide table → cards.** `RecordCard` shows the key fields; tap to expand the
  rest (Module, Assigned To, Dev Hours, Ageing, Dev/Testing Lead, etc.).
- **Dropdowns with `createPortal` → `FilterSheet`,** a single reusable,
  searchable, slide-up sheet used for Product / Sprint / Status / Client.
- **Right-click context menu → long-press `ActionSheet`,** offering the same
  actions (Mark/Remove Client Side Testing, Point Drop / Revert, Sprint
  Change) gated by the same role/permission checks as the web app
  (`PermissionAPI`, `CEO/COO/Product Head/Product Owner`, `Testing Lead`).
- **Pagination:** infinite scroll (`onEndReached`) instead of Prev/Next
  buttons, same `PAGE_SIZE = 20`.
- **Pull-to-refresh** replaces the manual "Refresh" button (the header
  refresh icon still works too).
- All colors/spacing/radii live in `src/theme/theme.js` so the look stays
  consistent and easy to re-skin.

## 5. Endpoints wired up

`SprintData`, `PermissionAPI`, `GetProduct`, `TeamLeadModuleMappingData`,
`TestingLeadModuleMappingData`, `GetPatchList`, `UpdateSprintClientSideTesting`,
and `Login` are called from the dashboard/login screens exactly as in the web
app. `GetProductGroup(Mapping)`, `AddPoint` (`GetPointSprint` /
`GetPointDetails` / `InsertSLASprintPoint`), `SaveDevEfforts`,
`UpdateTargetDate`, the Bug tab, and `MarkCritical` are already present in
`ENDPOINTS` and are natural next screens/sheets to build using the same
`FilterSheet` / `ActionSheet` / `authFetch` patterns already in the codebase.

## 6. Notes

- Uses Expo SDK 57 / React Native 0.86 / React 19.2 — matches the current
  Expo Go app (iOS only supports the latest Expo Go build, so the project's
  SDK has to track whatever's newest). If Expo Go on your phone updates to
  a newer SDK again later and you see "Project is incompatible with this
  version of Expo Go", run:
  ```bash
  npx expo install --fix
  ```
  to realign every package to the SDK your installed `expo` version expects
  (bump `expo` itself in `package.json` first if a whole new SDK has shipped).
- No native date-picker or icon-font dependency beyond `@expo/vector-icons`
  (bundled with Expo) was added, to keep `npx expo start` working with zero
  extra native config. Swap in `@react-native-community/datetimepicker` for
  a native calendar UI on the Target Date field when you build that editor.
