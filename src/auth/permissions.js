/**
 * ACTION-LEVEL PERMISSIONS
 *
 * The web app gates actions with TWO layers OR'd together:
 *
 *   1. a hardcoded role-name check  (sessionStorage 'role')
 *   2. per-user boolean flags from  GET /Zentao/PermissionAPI?userId=<id>
 *
 * e.g. SprintDashboard.jsx:
 *   const canAddPoint = ADD_POINT_ROLES.includes(role) || permissions.IsAddPoint;
 *
 * On the web these reads are synchronous (sessionStorage). On React Native
 * storage is async, so the role + flags are loaded once into PermissionContext
 * and the derived booleans are handed to screens ready-made.
 *
 * Keep the role arrays below in sync with the web app if it ever changes.
 */

/* =========================================================
   ROLE ARRAYS - verbatim from the live SprintDashboard.jsx
   ========================================================= */

export const ADD_POINT_ROLES = ['CEO', 'COO', 'Product Head', 'Product Owner'];
export const SPRINT_CHANGE_ROLES = ['CEO', 'COO', 'Product Head', 'Product Owner'];
export const DEV_EFFORT_ROLES = ['CEO', 'COO', 'Product Head', 'Product Owner'];
export const PRODUCT_MANAGEMENT_ROLES = ['CEO', 'COO', 'Product Head', 'Product Owner'];

/** Shape returned by PermissionAPI (data[0]); all default false. */
export const EMPTY_PERMISSIONS = {
  IsAddPoint: false,
  IsPointDrop: false,
  IsSprintChange: false,
  IsCriticalPointAdd: false,
  IsSprintCreation: false,
};

/**
 * The API is inconsistent about these flags' type - they come back as
 * boolean, number or string depending on the endpoint. Scrum.jsx tests all
 * four forms, so normalize the same way everywhere.
 *
 *   hasCriticalPointAddPermission in Scrum.jsx:
 *     permission?.IsCriticalPointAdd === true || === 1 ||
 *     String(...).toLowerCase() === "true" || String(...) === "1"
 */
export function truthyFlag(value) {
  if (value === true || value === 1) return true;
  const s = String(value).toLowerCase();
  return s === 'true' || s === '1';
}

/** `role.trim().toLowerCase() === "dev team lead"` - the web app matches loosely here. */
export function isDevTeamLeadRole(role) {
  return String(role || '').trim().toLowerCase() === 'dev team lead';
}

/**
 * Derive every action-level permission from a role + PermissionAPI flags.
 * Returns the same boolean names the web components use, so screen code
 * reads almost identically to the web original.
 */
export function derivePermissions(role, flags) {
  const r = role || '';
  const p = flags || EMPTY_PERMISSIONS;

  const isProductManagement = PRODUCT_MANAGEMENT_ROLES.includes(r);
  const isDevTeamLead = isDevTeamLeadRole(r);

  // canAddPoint = ADD_POINT_ROLES.includes(role) || permissions.IsAddPoint
  const canAddPoint = ADD_POINT_ROLES.includes(r) || truthyFlag(p.IsAddPoint);

  // canChangeSprint = SPRINT_CHANGE_ROLES.includes(role) || permissions.IsSprintChange
  const canChangeSprint = SPRINT_CHANGE_ROLES.includes(r) || truthyFlag(p.IsSprintChange);

  // canPointDrop = isProductManagement || permissions.IsPointDrop
  const canPointDrop = isProductManagement || truthyFlag(p.IsPointDrop);

  // canSaveTargetDate = canPointDrop || isDevTeamLead
  const canSaveTargetDate = canPointDrop || isDevTeamLead;

  // canEditDevEfforts = DEV_EFFORT_ROLES.includes(role) || isDevTeamLead
  const canEditDevEfforts = DEV_EFFORT_ROLES.includes(r) || isDevTeamLead;

  // MarkCriticalShared.jsx canMarkCritical(): role === "Support" || role === "Product Owner"
  const canMarkCritical = r === 'Support' || r === 'Product Owner';

  // Scrum.jsx - flag only, no role fallback.
  const canCriticalPointAdd = truthyFlag(p.IsCriticalPointAdd);

  // SprintMaster.jsx - strict: setCanCreateSprint(permission?.IsSprintCreation === true)
  // Kept strict on purpose to match the web app exactly.
  const canCreateSprint = p.IsSprintCreation === true;

  return {
    role: r,
    isProductManagement,
    isDevTeamLead,
    canAddPoint,
    canChangeSprint,
    canPointDrop,
    canSaveTargetDate,
    canEditDevEfforts,
    canMarkCritical,
    canCriticalPointAdd,
    canCreateSprint,
    raw: p,
  };
}
