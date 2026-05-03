import { QueryClient } from '@tanstack/react-query';
import { isTransientNetworkError } from '@/lib/networkErrors';

/**
 * QueryClient global — extraído para evitar ciclos de import entre
 * `App.tsx` e `useAuth.tsx` (signOut precisa chamar `queryClient.clear()`
 * para impedir vazamento de PII após logout em dispositivos compartilhados).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: false,
      retry: (failureCount, error) => {
        if (isTransientNetworkError(error)) return failureCount < 3;
        return failureCount < 1;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    },
  },
});
