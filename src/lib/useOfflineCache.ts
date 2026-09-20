import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { persistQueryClient } from "@tanstack/react-query-persist-client";

const CACHE_KEY = "ritual:query-cache";
const MAX_AGE = 1000 * 60 * 60 * 24 * 14; // keep two weeks of data for offline use

/**
 * Keeps the last loaded data in the browser so the app still shows habits,
 * lectures and deadlines when there is no connection.
 */
export function useOfflineCache(queryClient: QueryClient): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    queryClient.setDefaultOptions({
      queries: {
        gcTime: MAX_AGE,
        networkMode: "offlineFirst",
        retry: 1,
      },
    });

    const [unsubscribe] = persistQueryClient({
      queryClient,
      persister: createSyncStoragePersister({ storage: window.localStorage }),
      maxAge: MAX_AGE,
    });

    return unsubscribe;
  }, [queryClient]);
}
