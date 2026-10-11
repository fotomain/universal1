// ReusableTablePostButton - the Post button of a table with `postDataNeeded` (the task line table): the FIRST element of the toolbar panel.
//   state 'post'       text "Post"         the data was never posted (first edit)
//   state 'posted'     text "Posted"       the post finished and nothing changed since
//   state 'postNeeded' text "Post needed"  the data changed after it was posted
// The icon is always there; the text only on a wide window (`showText`). Background = `color` (project.uxuiSettings.postButtonBackgroundColor,
// light fuchsia by default); "Posted" is the quiet state (outlined), the two others are filled. Pressing it runs the post (onPost) in every state.
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import IconApp from '../../common/IconApp';
import { PM_DEFAULT_POST_BUTTON_COLOR, textColorOnBackground } from '../../../../pm/model/postButtonColors';
import { usePMTip } from '../../../../pm/inner/tooltip/PMTooltip';

export type ReusableTablePostState = 'post' | 'posted' | 'postNeeded';

export const POST_BUTTON_TEXT: Record<ReusableTablePostState, string> = { post: 'Post', posted: 'Posted', postNeeded: 'Post needed' };
export const POST_BUTTON_ICON: Record<ReusableTablePostState, string> = { post: 'cloud_upload', posted: 'cloud_done', postNeeded: 'sync_problem' };
const POST_BUTTON_TIP: Record<ReusableTablePostState, string> = {
  post: 'Post: save the plan of the lines',
  posted: 'Posted: the plan of the lines is up to date (press to post again)',
  postNeeded: 'The data changed after it was posted: press to post again',
};

/** the window width from which the button shows its text */
export const POST_BUTTON_WIDE_FROM = 900;

export interface ReusableTablePostButtonProps {
  state: ReusableTablePostState;
  onPress: () => void;
  color?: string;
  /** show the text beside the icon (wide window) */
  showText: boolean;
  busy?: boolean;
  disabled?: boolean;
  testID?: string;
}

export default function ReusableTablePostButton({ state, onPress, color = PM_DEFAULT_POST_BUTTON_COLOR, showText, busy, disabled, testID = 'reusable-table-post' }: ReusableTablePostButtonProps) {
  const text = POST_BUTTON_TEXT[state];
  const tip = usePMTip(POST_BUTTON_TIP[state], 'app');
  const filled = state !== 'posted';
  const fg = filled ? textColorOnBackground(color) : textColorOnBackground('#FFFFFF');
  return (
    <Pressable
      ref={tip.ref as any}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityHint={tip.accessibilityHint}
      accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      onHoverIn={tip.onHoverIn}
      onHoverOut={tip.onHoverOut}
      onPressIn={tip.onPressIn}
      onLongPress={tip.onLongPress}
      delayLongPress={tip.delayLongPress}
      style={[styles.button, { backgroundColor: filled ? color : color + '33', borderColor: color, opacity: disabled ? 0.5 : 1 }]}
    >
      {busy ? <ActivityIndicator size="small" color={fg} /> : <IconApp name={POST_BUTTON_ICON[state]} size={18} color={fg} />}
      {showText && <Text testID={`${testID}-text`} numberOfLines={1} style={[styles.text, { color: fg }]}>{text}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 32, minWidth: 34, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, marginRight: 6 },
  text: { fontSize: 13, fontWeight: '700' },
});
