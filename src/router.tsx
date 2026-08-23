import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { createQueryClient, queryClient as clientSingleton } from "@/lib/queryClient";

export const getRouter = () => {
  // No servidor, cada request recebe um QueryClient novo (evita vazamento de
  // cache entre usuários). No browser, mantém o singleton global — hooks como
  // useAuth chamam `queryClient.clear()` no signOut.
  const queryClient = typeof window === "undefined" ? createQueryClient() : clientSingleton;

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
