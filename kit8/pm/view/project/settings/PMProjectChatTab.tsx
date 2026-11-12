// PMProjectChatTab - the "Chat" tab of the Project settings window (TabChat, after TabFiles): the switch of the chat of the project's tasks (kit8/chat).
//   project_table.rowJSON.chatFunctionalityEnabled   TRUE while never saved (the database reads a missing value as true). OFF: the chats of the tasks of this project are hidden from the list,
//                                                    the red number and the task menus - nothing is deleted; the Main chat of a user is not a project thing and stays.
// The 4 letters in front of the title of a task chat (projectInnerPrefix) are a field of the Main tab (chatValuesOf keeps both).
import React from 'react';
import { Text, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import { pmT } from '../../../i18n/pmT';
import SwitchApp from '../../../../ui/components/common/SwitchApp';
import { chatEnabledOfProject, normalizePrefix } from '../../../../chat/chatModel';

export interface PMProjectChatValues {
  chatFunctionalityEnabled?: boolean;
  projectInnerPrefix?: string;
}

/** a missing chatFunctionalityEnabled is TRUE; the prefix is kept as typed (4 letters / digits, upper case) or '' (= the first 4 letters of the project name) */
export const chatValuesOf = (j: PMProjectChatValues | Record<string, any> | undefined | null): Required<PMProjectChatValues> => ({
  chatFunctionalityEnabled: chatEnabledOfProject(j as any),
  projectInnerPrefix: normalizePrefix((j as any)?.projectInnerPrefix),
});

export default function PMProjectChatTab({ values, onChange }: { values: PMProjectChatValues; onChange: (patch: PMProjectChatValues) => void }) {
  const { themeColors: c } = useDesignSystem();
  const on = chatEnabledOfProject(values as any);
  return (
    <View testID="pm-project-tab-chat-content" style={{ gap: 12 }}>
      <SwitchApp
        testID="pm-project-chat-enabled"
        label={pmT('Chat of the tasks (chatFunctionalityEnabled)')}
        value={on}
        onValueChange={(v: boolean) => onChange({ chatFunctionalityEnabled: v })}
      />
      <Text style={{ color: c.text, opacity: 0.7, fontSize: 13 }}>
        {pmT('On: every task has a chat (Task menu -> Create based on this -> Chat, or the icon Go to Chat). Its members are the users of the Time lines of the task (RACI). Off: the task chats of this project are hidden; nothing is deleted.')}
      </Text>
    </View>
  );
}
