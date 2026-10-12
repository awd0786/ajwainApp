import React from 'react';
import { useShell } from '../navigation/ShellContext';
import { Page } from '../ui';
import CreateTaskForm from '../components/CreateTaskForm';

/** Create Task page (web key: createTask). Sub-task data arrives via pageParams. */
export default function CreateTaskScreen() {
  const { pageParams } = useShell();
  return (
    <Page>
      <CreateTaskForm subTaskData={pageParams?.subTaskData} />
    </Page>
  );
}
