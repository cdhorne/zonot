// Temporary stub for screens whose UI lands in Phase 3(d). Replaced as the
// design system + real screens are built; keeps the route tree navigable now.
import { Text, View } from 'react-native';

export function Placeholder({ label }: { label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: 16, opacity: 0.6 }}>{label}</Text>
    </View>
  );
}
