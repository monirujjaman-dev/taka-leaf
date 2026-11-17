import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { db, migrateOnce } from "./db/client";
import { apiClient, storedUser } from "./state/account";
import { httpSyncApi, syncNow } from "./sync/engine";

export const SYNC_TASK = "takaleaf-sync";

// Defined at module load (imported from the root layout), so Android can start it with the app closed.
TaskManager.defineTask(SYNC_TASK, async () => {
  try {
    if (!storedUser()) return BackgroundTask.BackgroundTaskResult.Success;
    await migrateOnce();
    const client = apiClient();
    await syncNow(db, httpSyncApi((path, init) => client.request(path, init)));
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export type BackgroundState = "on" | "restricted" | "unavailable";

/** Registers the sync task once. Android decides when it runs: every 15 minutes at the most often. */
export async function registerSyncTask(): Promise<BackgroundState> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return "restricted";
    if (await TaskManager.isTaskRegisteredAsync("takaleaf-health-check")) await BackgroundTask.unregisterTaskAsync("takaleaf-health-check");
    if (!(await TaskManager.isTaskRegisteredAsync(SYNC_TASK))) await BackgroundTask.registerTaskAsync(SYNC_TASK, { minimumInterval: 15 });
    return "on";
  } catch {
    return "unavailable";
  }
}
