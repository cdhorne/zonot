// Root layout (mobile-spec §8.1). Providers (Restyle theme, query client, toast,
// error boundary) and the auth guard (redirect to /onboarding when no creds) wire
// in as those systems land; for now it's the root Stack.
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
