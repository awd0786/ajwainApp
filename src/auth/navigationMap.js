/**
 * NAVIGATION MAP + ROLE-BASED ACCESS
 *
 * This is a direct port of the web app's `src/components/Navbar.jsx`
 * (NAV_GROUPS + allowedKeys) and `src/App.jsx` (getDefaultPage).
 *
 * The page `key` values are deliberately IDENTICAL to the web app's
 * `currentPage` keys so that permission rules, bug reports and future
 * changes translate one-to-one between web and mobile.
 */

/* =========================================================
   NAV GROUPS
   Mirrors NAV_GROUPS in Navbar.jsx, same order, same labels.
   `icon` values are Feather names (@expo/vector-icons), chosen to
   match the react-icons/fi names the web app uses.
   ========================================================= */

export const NAV_GROUPS = [
  {
    key: 'bugDashboard',
    label: 'Bug Dashboard',
    icon: 'grid',
    type: 'single',
    items: [{ key: 'sla', label: 'Bug Dashboard', icon: 'grid', color: '#60A5FA' }],
  },

  {
    key: 'sprintMain',
    label: 'Sprint',
    icon: 'zap',
    type: 'single',
    items: [{ key: 'sprint', label: 'Sprint', icon: 'zap', color: '#818CF8' }],
  },

  {
    key: 'patchManagement',
    label: 'Patch Management',
    icon: 'package',
    type: 'dropdown',
    items: [
      { key: 'patch', label: 'Create Patch', icon: 'package', color: '#34D399' },
      { key: 'viewPatch', label: 'Build Review & Assignment', icon: 'eye', color: '#FBBF24' },
      { key: 'patchpriority', label: 'Patch Prioritization', icon: 'git-pull-request', color: '#A78BFA' },
    ],
  },

  {
    key: 'bugMonitoring',
    label: 'Bug Monitoring',
    icon: 'alert-circle',
    type: 'dropdown',
    items: [
      { key: 'pendingReplication', label: 'Pending Replication Bugs', icon: 'alert-circle', color: '#F87171' },
      { key: 'assignedCounts', label: 'Workload & Progress', icon: 'activity', color: '#FB7185' },
    ],
  },

  {
    key: 'taskMonitoring',
    label: 'Task Monitoring',
    icon: 'check-square',
    type: 'dropdown',
    items: [
      { key: 'taskWorklist', label: 'Zentao Task Worklist', icon: 'check-square', color: '#2DD4BF' },
      { key: 'ajwainBoard', label: 'Ajwain Board', icon: 'activity', color: '#818CF8' },
      { key: 'createTask', label: 'Create Task', icon: 'check-square', color: '#34D399' },
      { key: 'taskView', label: 'Task View', icon: 'activity', color: '#818CF8' },
    ],
  },

  {
    key: 'planningGovernance',
    label: 'Critical Bugs Monitoring',
    icon: 'monitor',
    type: 'dropdown',
    items: [
      { key: 'scrum', label: 'Scrum & Critical Points Dashboard', icon: 'activity', color: '#818CF8' },
    ],
  },

  {
    key: 'reports',
    label: 'Reports',
    icon: 'file-text',
    type: 'dropdown',
    items: [
      { key: 'report', label: 'Sprint Point Report', icon: 'file-text', color: '#4ADE80' },
      { key: 'findPoint', label: 'Find Point Sprint', icon: 'file-text', color: '#4ADE80' },
    ],
  },

  {
    key: 'master',
    label: 'Master',
    icon: 'layers',
    type: 'dropdown',
    items: [
      { key: 'sprintMaster', label: 'Sprint Master', icon: 'layers', color: '#A78BFA' },
      { key: 'settings', label: 'Settings', icon: 'settings', color: '#94A3B8' },
      { key: 'userMaster', label: 'User Master', icon: 'users', color: '#94A3B8' },
      { key: 'permission', label: 'Permission Master', icon: 'code', color: '#94A3B8' },
    ],
  },
];

/* =========================================================
   ROLE BASED ACCESS
   Verbatim port of the allowedKeys IIFE in Navbar.jsx.
   Returning null means "no restriction - all pages".
   ========================================================= */

export function getAllowedKeys(role) {
  const r = role || '';

  if (['Testing', 'Testing Lead'].includes(r)) {
    return [
      'sla',
      'scrum',
      'viewPatch',
      'pendingReplication',
      'sprint',
      'report',
      'assignedCounts',
      'patchpriority',
      'sprintMaster',
      'taskWorklist',
      'createTask',
      'taskView',
      'settings',
      'ajwainBoard',
      'findPoint',
    ];
  }

  if (['Developer', 'Dev Team Lead'].includes(r)) {
    return [
      'sla',
      'patch',
      'scrum',
      'viewPatch',
      'pendingReplication',
      'sprint',
      'report',
      'assignedCounts',
      'taskWorklist',
      'createTask',
      'taskView',
      'settings',
      'ajwainBoard',
      'findPoint',
    ];
  }

  if (['Support', 'Sales'].includes(r)) {
    return [
      'sla',
      'scrum',
      'viewPatch',
      'pendingReplication',
      'report',
      'assignedCounts',
      'sprintMaster',
      'sprint',
      'taskWorklist',
      'createTask',
      'taskView',
      'ajwainBoard',
      'findPoint',
    ];
  }

  // Default - all pages
  return null;
}

/** Filter NAV_GROUPS down to what this role may see, dropping empty groups. */
export function getVisibleGroups(role) {
  const allowedKeys = getAllowedKeys(role);

  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => (allowedKeys ? allowedKeys.includes(item.key) : true)),
  })).filter((group) => group.items.length > 0);
}

/** True if this role may open the given page key. */
export function isPageAllowed(role, pageKey) {
  const allowedKeys = getAllowedKeys(role);
  if (!allowedKeys) return true;
  return allowedKeys.includes(pageKey);
}

/**
 * Landing page after login. Verbatim port of getDefaultPage() in App.jsx.
 */
export function getDefaultPage(role) {
  const r = role || '';
  if (['Testing', 'Testing Lead'].includes(r)) return 'viewPatch';
  if (['Developer', 'Dev Team Lead'].includes(r)) return 'patch';
  return 'sprint';
}

/** Flat lookup of pageKey -> { label, icon, groupLabel } for headers/titles. */
export const PAGE_META = NAV_GROUPS.reduce((acc, group) => {
  group.items.forEach((item) => {
    acc[item.key] = { label: item.label, icon: item.icon, color: item.color, groupLabel: group.label };
  });
  return acc;
}, {});
