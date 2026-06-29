import { Redirect } from 'expo-router';

// Launch → capture tab (the wedge: capture is the front door, mobile-spec §8.2).
export default function Index() {
  return <Redirect href="/(tabs)/capture" />;
}
