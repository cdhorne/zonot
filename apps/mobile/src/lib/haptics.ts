// Haptic feedback wrappers (mobile-spec §2 / §3.1). Best-effort — never throw
// into the UI if the platform has no haptics engine.

import * as Haptics from 'expo-haptics';

export const haptics = {
  /** Soft pulse: a new chip appears, a capture reaches DURABLE. */
  light: () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  /** Success notification: a write is acked SYNCED (used sparingly). */
  success: () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  /** Warning: a destructive confirm (undo / delete). */
  warning: () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
};
