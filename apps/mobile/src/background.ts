import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { runBackgroundCheck } from "./backgroundCheck";
import { db, migrateOnce } from "./db/client";

export const HEALTH_TASK = "takaleaf-health-check";

// Defined at module load (imported from the root layout), so Android can start it with the app closed.
TaskManager.defineTask(HEALTH_TASK, async () => {
  try {
    await migrateOnce();
    await runBackgroundCheck(db);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export type BackgroundState = "on" | "restricted" | "unavailable";

/** Registers the task once. Android decides when it runs: every 15 minutes at the most often. */
export async function registerHealthTask(): Promise<BackgroundState> {
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return "restricted";
  if (!(await TaskManager.isTaskRegisteredAsync(HEALTH_TASK))) {
    await BackgroundTask.registerTaskAsync(HEALTH_TASK, { minimumInterval: 15 });
  }
  return "on";
}

/** Development builds only: asks Android to run the task now, to test it without waiting. */
export function runHealthTaskNow(): Promise<boolean> {
  return BackgroundTask.triggerTaskWorkerForTestingAsync();
}
