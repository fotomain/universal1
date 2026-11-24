// Calls `onFocus` every time the screen that holds the list comes into focus (a Drawer screen stays mounted after the first visit).
// A component of its own: the hook `useFocusEffect` needs a navigator, so only a list that asks for `refreshOnFocus` mounts it.
import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

export default function RefreshOnFocus({ onFocus }: { onFocus: () => void }) {
  useFocusEffect(useCallback(() => { onFocus(); }, [onFocus]));
  return null;
}
