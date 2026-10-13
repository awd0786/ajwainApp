/**
 * SINGLE SOURCE OF TRUTH for API configuration.
 *
 * Every screen / service in this app must import BASE_URL, ENDPOINTS or
 * apiUrl() from this file instead of hardcoding paths. If your backend URL
 * or a route ever changes, this is the only file you need to touch.
 *
 * This mirrors the web app's `window.RUNTIME_CONFIG.API_URL`
 * (public/runtime-config.js), which is the live value the Zentao SLA
 * Dashboard runs against. The base already includes `/api`, so every
 * endpoint path below starts at `/Zentao/...`.
 */

export const BASE_URL = 'https://sanity.voiceai.co.in/SLADashAPI/api';

/** Zentao web UI – used for "open bug / story / task" deep links. */
export const ZENTAO_WEB_URL = 'http://206.19.38.3:8080/zentao/www';

/** zentaoLink('bug', 123) -> http://…/bug-view-123.html */
export function zentaoLink(type, id) {
  const t = String(type || 'bug').toLowerCase();
  return `${ZENTAO_WEB_URL}/${t}-view-${id}.html`;
}

/** Mirrors window.RUNTIME_CONFIG from the web app's runtime-config.js. */
export const RUNTIME_CONFIG = {
  REFRESH_INTERVAL: 60, // seconds, used by auto-refreshing dashboards
};

export const ENDPOINTS = {
  /* ---------------------------------------------------------------
     AUTH / SESSION
     --------------------------------------------------------------- */
  login: '/Zentao/Login',
  changePassword: '/Zentao/ChangePasswordSLADashboard',

  /* PUSH NOTIFICATIONS – device token registry (Expo push tokens) */
  registerPushToken: '/Zentao/RegisterPushToken',
  unregisterPushToken: '/Zentao/UnregisterPushToken',

  /* ---------------------------------------------------------------
     PERMISSIONS
     PermissionAPI  -> per-user runtime flags used to gate UI.
     GetPermissionData / SaveUpdateAjwainPermission -> Permission Master.
     --------------------------------------------------------------- */
  permission: '/Zentao/PermissionAPI',
  getPermissionData: '/Zentao/GetPermissionData',
  saveUpdateAjwainPermission: '/Zentao/SaveUpdateAjwainPermission',

  /* ---------------------------------------------------------------
     PRODUCTS / MODULES / GROUPS / USERS (shared lookups)
     --------------------------------------------------------------- */
  getProduct: '/Zentao/GetProduct',
  zentaoProduct: '/Zentao/ZentaoProduct',
  zentaoModule: '/Zentao/ZentaoModule',
  zentaoUserDB: '/Zentao/ZentaoUserDB',
  getProductGroup: '/Zentao/GetProductGroup',
  getProductGroupMapping: '/Zentao/GetProductGroupMapping',
  saveProductGroup: '/Zentao/SaveProductGroup',
  saveProductGroupMapping: '/Zentao/SaveProductGroupMapping',
  clientFilter: '/Zentao/ClientFilter',
  teamLeadFilter: '/Zentao/TeamLeadFilter',
  scrumMaster: '/Zentao/ScrumMaster',

  /* ---------------------------------------------------------------
     SPRINT
     --------------------------------------------------------------- */
  sprintData: '/Zentao/SprintData',
  sprintDataByProductSprint: '/Zentao/SprintDataByProductSprint',
  productSprint: '/Zentao/ProductSprint',
  productPointList: '/Zentao/ProductPointList',
  createSprint: '/Zentao/CreateSprint',
  closeSprint: '/Zentao/CloseSprint',
  getPointSprint: '/Zentao/GetPointSprint',
  getCurrentSprint: '/Zentao/GetCurrentSprint',
  getPointDetails: '/Zentao/GetPointDetails',
  getPointDetail: '/Zentao/GetPointDetail',
  insertSLASprintPoint: '/Zentao/InsertSLASprintPoint',
  updateSprintClientSideTesting: '/Zentao/UpdateSprintClientSideTesting',
  removeClientSideTestingPointDropStatus: '/Zentao/RemoveClientSideTestingPointDropStatus',
  saveDevEfforts: '/Zentao/SaveDevEfforts',
  updateTargetDate: '/Zentao/UpdateTargetDate',
  getVersions: '/Zentao/GetVersions',

  /* ---------------------------------------------------------------
     PATCH MANAGEMENT
     --------------------------------------------------------------- */
  getPatchList: '/Zentao/GetPatchList',
  getPatchPointsBySprint: '/Zentao/GetPatchPointsBySprint',
  createPatch: '/Zentao/CreatePatch',
  refreshPatchStatuses: '/Zentao/RefreshPatchStatuses',
  patchPoints: '/Zentao/PatchPoints',
  patchPointsSanity: '/Zentao/PatchPointsSanity',
  patchPointsRegression: '/Zentao/PatchPointsRegression',
  assignPatchPoint: '/Zentao/AssignPatchPointSLADashboard',
  markPointStatus: '/Zentao/MarkPointStatus',
  markPrioritizedPatchPoint: '/Zentao/MarkPrioritizedPatchPoint',
  markApprovedCRF: '/Zentao/MarkApprovedCRF',

  /* ---------------------------------------------------------------
     BUG DASHBOARD / MONITORING
     --------------------------------------------------------------- */
  getTotalBugList: '/Zentao/GetTotalBugList',
  getTotalClosedStory: '/Zentao/GetTotalClosedStory',
  pendingReplicationBugs: '/Zentao/PendingReplicationBugs',
  accountWiseCountAssignee: '/Zentao/AccountWiseCountAssignee',
  teamLeadWiseCount: '/Zentao/TeamLeadWiseCount',
  testingTeamLeadWiseData: '/Zentao/TestingTeamLeadWiseData',
  developerSummary: '/Zentao/DeveloperSummary',
  developerDailySummary: '/Zentao/DeveloperDailySummary',

  /* ---------------------------------------------------------------
     CRITICAL POINTS (Scrum)
     --------------------------------------------------------------- */
  getCriticalPoints: '/Zentao/GetCriticalPoints',
  markPointCritical: '/Zentao/MarkPointCritical',
  deleteCriticalMarkedPoint: '/Zentao/DeleteCriticalMarkedPoint',
  saveTargetandCloseCriticalPoint: '/Zentao/SaveTargetandCloseCriticalPoint',

  /* ---------------------------------------------------------------
     TASKS (Ajwain)
     --------------------------------------------------------------- */
  taskMaster: '/Zentao/TaskMaster',
  createTask: '/Zentao/CreateTask',
  zentaoTaskDetails: '/Zentao/ZentaoTaskDetails',
  getTaskPointById: '/Zentao/GetTaskPointById',
  getTaskPointByAssignedTo: '/Zentao/GetTaskPointByAssignedTo',
  viewTaskPointList: '/Zentao/ViewTaskPointList',
  updateTaskPointStatus: '/Zentao/UpdateTaskPointStatus',
  getTaskPointComments: '/Zentao/GetTaskPointComments',
  saveTaskPointComments: '/Zentao/SaveTaskPointComments',
  uploadDocument2: '/Zentao/UploadDocument2',
  fetchDocument: '/Zentao/FetchDocument',
  fetchDocument2: '/Zentao/FetchDocument2',

  /* ---------------------------------------------------------------
     USER MASTER
     --------------------------------------------------------------- */
  getAjwainUserList: '/Zentao/GetAjwainUserList',
  saveUpdateAjwainUser: '/Zentao/SaveUpdateAjwainUser',

  /* ---------------------------------------------------------------
     SETTINGS - TEAM LEAD / TESTING LEAD / DEVELOPER MAPPINGS
     NOTE: the six save/delete endpoints below are the only ones in the
     whole API that take a JSON *body*. Everything else is query-string.
     --------------------------------------------------------------- */
  teamLeadModuleMapping: '/Zentao/TeamLeadModuleMappingData',
  teamLeadDevMapping: '/Zentao/TeamLeadDevMappingData',
  testingLeadModuleMapping: '/Zentao/TestingLeadModuleMappingData',
  teamLeadModulesName: '/Zentao/TeamLeadModulesName',
  saveModuleTeamLeadMapping: '/Zentao/SaveModuleTeamLeadMapping',
  deleteModuleTeamLeadMapping: '/Zentao/DeleteModuleTeamLeadMapping',
  saveTeamLeadDeveloperMapping: '/Zentao/SaveTeamLeadDeveloperMapping',
  deleteTeamLeadDeveloperMapping: '/Zentao/DeleteTeamLeadDeveloperMapping',
  saveModuleTestingLeadMapping: '/Zentao/SaveModuleTestingLeadMapping',
  deleteModuleTestingLeadMapping: '/Zentao/DeleteModuleTestingLeadMapping',
};

/**
 * Build a full URL for an endpoint key with optional query params.
 *
 *   apiUrl('sprintData')                                -> {base}/Zentao/SprintData
 *   apiUrl('getPointDetails', { pointId: 12, type: 's' }) -> ...?pointId=12&type=s
 *
 * Empty string / null / undefined params are dropped, matching the web
 * app's URLSearchParams usage closely enough for every endpoint in use.
 * Pass a raw path instead of a key if you need something not listed above.
 */
export function apiUrl(key, params) {
  const path = ENDPOINTS[key] || key;
  const url = `${BASE_URL}${path}`;
  if (!params) return url;
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return qs ? `${url}?${qs}` : url;
}

/**
 * Same as apiUrl but KEEPS empty-string values, because several endpoints
 * expect the key to be present even when blank (e.g. closingRemarks,
 * TargetChangeRemarks). The web app builds these with URLSearchParams,
 * which always emits the key.
 */
export function apiUrlKeepEmpty(key, params) {
  const path = ENDPOINTS[key] || key;
  const url = `${BASE_URL}${path}`;
  if (!params) return url;
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return qs ? `${url}?${qs}` : url;
}
