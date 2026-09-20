/**
 * SINGLE SOURCE OF TRUTH for API configuration.
 * Every screen / service in this app must import BASE_URL, ENDPOINTS or
 * apiUrl() from this file instead of hardcoding paths. If your backend URL
 * or a route ever changes, this is the only file you need to touch.
 */

// TODO: point this at your API server.
// - Android emulator reaching a server on your dev machine: use 10.0.2.2
// - Physical device on the same Wi-Fi: use your machine's LAN IP (e.g. 192.168.1.50)
// - iOS simulator: localhost works fine
export const BASE_URL = 'https://sanity.voiceai.co.in/SLADashAPI/api';

export const ENDPOINTS = {
  login: '/Zentao/Login',
  permission: '/Zentao/PermissionAPI',

  sprintData: '/Zentao/SprintData',
  getProduct: '/Zentao/GetProduct',
  getProductGroup: '/Zentao/GetProductGroup',
  getProductGroupMapping: '/Zentao/GetProductGroupMapping',

  teamLeadModuleMapping: '/Zentao/TeamLeadModuleMappingData',
  testingLeadModuleMapping: '/Zentao/TestingLeadModuleMappingData',

  getPatchList: '/Zentao/GetPatchList',
  getPatchPointsBySprint: '/Zentao/GetPatchPointsBySprint',

  getPointSprint: '/Zentao/GetPointSprint',
  getPointDetails: '/Zentao/GetPointDetails',
  insertSLASprintPoint: '/Zentao/InsertSLASprintPoint',

  saveDevEfforts: '/Zentao/SaveDevEfforts',
  updateTargetDate: '/Zentao/UpdateTargetDate',
  updateSprintClientSideTesting: '/Zentao/UpdateSprintClientSideTesting',
  removeClientSideTestingPointDropStatus: '/Zentao/RemoveClientSideTestingPointDropStatus',
};

/**
 * Build a full URL for an endpoint key with optional query params.
 * apiUrl('sprintData') -> http://host/api/Zentao/SprintData
 * apiUrl('getPointDetails', { pointId: 12, type: 'story' })
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
