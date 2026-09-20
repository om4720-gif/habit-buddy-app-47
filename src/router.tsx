import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { setupOfflineCache } from "./lib/useOfflineCache";

export const getRouter = () => {
  const queryClient = new QueryClient();

  // Restore the saved data before anything renders so the app still shows
  // habits, lectures and deadlines without a connection.
  setupOfflineCache(queryClient);

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
