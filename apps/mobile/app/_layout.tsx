// Root layout (mobile-spec §8.1): provider stack + one-time bootstrap (open the
// db, hydrate the active workspace, bind the sync worker). Routing decisions
// live in app/index.tsx once `status` settles.

import { ThemeProvider } from '@shopify/restyle';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDatabase } from '@/db/database';
import { darkTheme, lightTheme } from '@/design/theme';
import { useSync } from '@/state/sync';
import { useWorkspace } from '@/state/workspace';

void SplashScreen.preventAutoHideAsync();

// Reads are manually invalidated after writes; never auto-refetch (Fathom's lead).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: Number.POSITIVE_INFINITY, retry: false, refetchOnWindowFocus: false },
  },
});

export default function RootLayout() {
  const theme = useColorScheme() === 'dark' ? darkTheme : lightTheme;
  const [ready, setReady] = useState(false);
  const hydrate = useWorkspace((s) => s.hydrate);
  const endpoint = useWorkspace((s) => s.endpoint);
  const configure = useSync((s) => s.configure);

  useEffect(() => {
    initDatabase();
    hydrate().finally(() => {
      setReady(true);
      void SplashScreen.hideAsync();
    });
  }, [hydrate]);

  // Bind the sync worker whenever the active endpoint changes.
  useEffect(() => {
    if (endpoint) configure(endpoint);
  }, [endpoint, configure]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={theme}>
            <Stack screenOptions={{ headerShown: false }} />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
