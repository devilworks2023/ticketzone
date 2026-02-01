import { httpLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import superjson from 'superjson';
import { Platform } from 'react-native';

import type { AppRouter } from '@/backend/trpc/app-router';

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  
  if (envUrl) {
    return envUrl;
  }
  
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location) {
      return window.location.origin;
    }
    return '';
  }
  
  return '';
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
    }),
  ],
});
