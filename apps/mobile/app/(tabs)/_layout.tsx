// Two tabs only — capture (launch) + browse (mobile-spec §8.2). The read view is
// a route (/note/[id]) in the browse stack, not a tab.
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="capture" options={{ title: 'Capture' }} />
      <Tabs.Screen name="browse" options={{ title: 'Browse' }} />
    </Tabs>
  );
}
