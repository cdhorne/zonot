import { Stack } from 'expo-router';
import { Placeholder } from '@/components/Placeholder';

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Placeholder label="This screen doesn't exist." />
    </>
  );
}
