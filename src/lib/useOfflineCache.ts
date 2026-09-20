import type { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { persistQueryClient } from "@tanstack/react-query-persist-client";

const CACHE_KEY = "ritual:query-cache";
const MAX_AGE = 1000 * 60 * 60 * 24 * 14; // keep two weeks of data for offline use

/**
 * Keeps the last loaded data in the browser so the app still shows habits,
 * lectures and deadlines when there is no connection.
 *
 * Must run before the first render (from the router factory), otherwise the
 * pages fire their requests before the saved data has been restored and show
 * empty screens while offline.
 */
export function setupOfflineCache(queryClient: QueryClient): void {
  if (typeof window === "undefined") return;

  queryClient.setDefaultOptions({
    queries: {
      gcTime: MAX_AGE,
      staleTime: 1000 * 30,
      networkMode: "offlineFirst",
      retry: 1,
524: 
    },
    mutations: {
      networkMode: "offlineFirst",
    },
  });

  try {
    persistQueryClient({
      queryClient,
      persister: createSyncStoragePersister({
        storage: window.localStorage,
        key: CACHE_KEY,
      }),
      maxAge: MAX_AGE,
    });
  } catch {
    /* storage can be unavailable (private mode); offline cache is optional */
  }
}
