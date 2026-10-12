/**
 * Page registry: web `currentPage` key  ->  mobile screen component.
 * Keys are identical to the web App.jsx / Navbar.jsx keys.
 */
import PendingReplicationScreen from '../screens/PendingReplicationScreen';
import UserMasterScreen from '../screens/UserMasterScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SprintMasterScreen from '../screens/SprintMasterScreen';
import TaskWorklistScreen from '../screens/TaskWorklistScreen';
import ViewPatchScreen from '../screens/ViewPatchScreen';
import TaskViewScreen from '../screens/TaskViewScreen';
import CreatePatchScreen from '../screens/CreatePatchScreen';
import PatchPrioritizationScreen from '../screens/PatchPrioritizationScreen';
import WorkloadScreen from '../screens/WorkloadScreen';
import CreateTaskScreen from '../screens/CreateTaskScreen';
import AjwainBoardScreen from '../screens/AjwainBoardScreen';
import PermissionMasterScreen from '../screens/PermissionMasterScreen';
import BugDashboardScreen from '../screens/BugDashboardScreen';
import SprintDashboardScreen from '../screens/SprintDashboardScreen';
import ScrumScreen from '../screens/ScrumScreen';
import ReportScreen from '../screens/ReportScreen';
import FindPointScreen from '../screens/FindPointScreen';

export const PAGES = {
  pendingReplication: PendingReplicationScreen,
  userMaster: UserMasterScreen,
  settings: SettingsScreen,
  sprintMaster: SprintMasterScreen,
  taskWorklist: TaskWorklistScreen,
  viewPatch: ViewPatchScreen,
  taskView: TaskViewScreen,
  patch: CreatePatchScreen,
  patchpriority: PatchPrioritizationScreen,
  assignedCounts: WorkloadScreen,
  createTask: CreateTaskScreen,
  ajwainBoard: AjwainBoardScreen,
  permission: PermissionMasterScreen,
  sla: BugDashboardScreen,
  sprint: SprintDashboardScreen,
  scrum: ScrumScreen,
  report: ReportScreen,
  findPoint: FindPointScreen,
};
