import { useLocalSearchParams } from 'expo-router';
import { Placeholder } from '@/components/Placeholder';

// Read view (mobile-spec §7) — lands in Phase 3(d).
export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Placeholder label={`Read note ${id} (§7)`} />;
}
