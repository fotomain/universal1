// ChatBadge - the chat icon with a RED NUMBER of the unread messages, in the application bar right before the three dots menu. It exists only while something is unread:
// when everything is read (mark read of the open theme) it disappears. Press = the list of the themes.
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDesignSystem } from '../providers/WithDesignSystem';
import IconApp from '../ui/components/common/IconApp';
import { badgeText } from './chatModel';
import { openChatList } from './chatNavigation';
import { useChatUnread } from './useChat';

export interface ChatBadgeViewProps { total: number; color: string; onPress: () => void; testID?: string }

/** the look alone (no hooks): tested without the data layer */
export function ChatBadgeView({ total, color, onPress, testID = 'appbar-chat' }: ChatBadgeViewProps) {
  const text = badgeText(total);
  if (!text) return null;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`Chat, ${text} new`} onPress={onPress} style={styles.btn} {...(Platform.OS === 'web' ? ({ title: `Chat: ${text} new` } as any) : {})}>
      <View>
        <IconApp testID={`${testID}-icon`} name="chat" size={22} color={color} />
        <View testID={`${testID}-count`} style={styles.count}>
          <Text style={styles.countText}>{text}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function ChatBadge() {
  const { themeColors } = useDesignSystem();
  const router = useRouter();
  const { total } = useChatUnread();
  return <ChatBadgeView total={total} color={themeColors.text} onPress={() => openChatList(router)} />;
}

const styles = StyleSheet.create({
  btn: { padding: 8 },
  count: { position: 'absolute', top: -6, right: -8, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  countText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
});
