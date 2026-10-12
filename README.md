# Ajwain — Expo Mobile App

React Native (Expo SDK 57) version of the **Zentao SLA Dashboard** web app.
It calls the same .NET API (`ZentaoController`) and applies the same role and
`PermissionAPI` rules as the web app. The UI is built for phones and follows the
device's light or dark setting.

## 1. Install & run

```bash
npm install          # new native modules were added; run this after pulling
npx expo start
```

New native modules: `expo-file-system`, `expo-sharing`, `expo-print`,
`expo-document-picker`, `expo-web-browser`, `react-native-svg`,
`@react-native-community/datetimepicker`. Expo Go already includes them. If you
use a **development build** (EAS / `expo run:android`), rebuild it once.

If `npm install` reports peer-version warnings, run `npx expo install --fix` to
align versions with the SDK.

## 2. API URL

`src/api/config.js` holds `BASE_URL` and every endpoint path (`ENDPOINTS`).
Screens call `api.get('key', params)` / `api.post('key', params)` from
`src/api/client.js`, and the bearer token is attached by `authFetch.js`.

## 3. Pages (same keys as the web `currentPage`)

| Drawer group | Page key | Screen |
|---|---|---|
| Bug Dashboard | `sla` | `BugDashboardScreen` |
| Sprint | `sprint` | `SprintDashboardScreen` |
| Patch Management | `patch`, `viewPatch`, `patchpriority` | `CreatePatchScreen`, `ViewPatchScreen`, `PatchPrioritizationScreen` |
| Bug Monitoring | `pendingReplication`, `assignedCounts` | `PendingReplicationScreen`, `WorkloadScreen` |
| Task Monitoring | `taskWorklist`, `ajwainBoard`, `createTask`, `taskView` | `TaskWorklistScreen`, `AjwainBoardScreen`, `CreateTaskScreen`, `TaskViewScreen` |
| Critical Bugs Monitoring | `scrum` | `ScrumScreen` (Overview · Not Assigned · Critical) |
| Reports | `report`, `findPoint` | `ReportScreen`, `FindPointScreen` |
| Master | `sprintMaster`, `settings`, `userMaster`, `permission` | `SprintMasterScreen`, `SettingsScreen`, `UserMasterScreen`, `PermissionMasterScreen` |

`src/navigation/pages.js` maps each key to its screen.

## 4. Permissions

- **Page access by role.** `src/auth/navigationMap.js` copies the web
  `Navbar.jsx` `allowedKeys` and `App.jsx` `getDefaultPage()` exactly.
- **Action permissions.** `src/auth/permissions.js` combines the hard-coded role
  lists with the per-user `PermissionAPI` flags (`IsAddPoint`, `IsPointDrop`,
  `IsSprintChange`, `IsCriticalPointAdd`, `IsSprintCreation`).
  `PermissionContext` loads these flags once and every screen reads them.
- The page-specific rules are kept as on the web. Examples: Testing Lead
  client-side-testing actions, Dev Team Lead "save once" for target date and dev
  efforts, sprint close (COO/CEO or user 14/15), critical-point close/delete
  (Support / Product Owner or user 1/11).

## 5. Project structure

```
App.js                      Theme → Toast → Auth → Navigator
src/
  api/                      config.js (URLs) · authFetch.js · client.js (api.get/post)
  auth/                     navigationMap.js (role → pages) · permissions.js (action flags)
  context/                  AuthContext · PermissionContext
  navigation/               MainShell (single-page shell), AppHeader, AppDrawer, pages.js
  theme/theme.js            light/dark palettes, makeStyles(), status colours
  ui/                       design system: Card, Button, Pill, Select (single/multi),
                            DateField, Sheet (bottom sheet), FilterSheet, charts (SVG), …
  components/               MarkCriticalSheet, SprintSheets (add point, sprint change,
                            point history, breakdown), CreateTaskForm, HtmlText, …
  hooks/useAsync.js         loading / refresh helper
  utils/                    format.js (dates, ageing, status) · exporter.js (xlsx/csv/pdf
                            share, file open) · storage.js (AsyncStorage session)
  screens/                  one file per page
```

## 6. How the web UI maps to mobile

- **Tables → cards.** Every row is a card with the key fields shown, plus a
  "Details" toggle for the rest.
- **Dropdowns and modals → bottom sheets.** Searchable single/multi-select
  pickers, plus a filter sheet with active-filter chips.
- **Right-click menu → tap a card** for the action sheet. **Row checkboxes →
  long-press** to multi-select (bulk sprint change).
- **Excel / CSV / PDF export** builds the file on the device and opens the share
  sheet.
- **Pagination → "Load more"** (same page sizes). **Pull to refresh** on every
  list.
