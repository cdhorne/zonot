// Entry route: send the user to capture when connected, else onboarding
// (mobile-spec §8.2 — capture is the front door once a workspace is wired).
import { Redirect } from 'expo-router';
import { useWorkspace } from '@/state/workspace';

export default function Index() {
  const status = useWorkspace((s) => s.status);
  if (status === 'connected') return <Redirect href="/(tabs)/capture" />;
  return <Redirect href="/onboarding" />;
}
