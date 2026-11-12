// OrganizationChatSection - Organization edit -> tab Chat: the biggest attachment of a chat message in MB (organizationTable.rowJSON.maximumChatAttachmentFileSize, 1..100, default 10).
// Only a project manager or an administrator changes it: the value is saved by the RPC chat_set_max_attachment_size (the table itself is changed by the administrator only); everybody else sees it.
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useDesignSystem } from '../providers/WithDesignSystem';
import { pmT } from '../pm/i18n/pmT';
import TextInputApp from '../ui/components/common/TextInputApp';
import { MAX_ATTACHMENT_KEY, maxAttachmentError, maxAttachmentMbOf } from './chatModel';
import { chatSetMaxAttachmentSize } from './chatApi';
import { useChatClient } from './useChatClient';

export default function OrganizationChatSection({ organizationJSON, onSaved, testID = 'organization-chat' }: { organizationJSON?: Record<string, any> | null; onSaved?: (mb: number) => void; testID?: string }) {
  const { themeColors: c } = useDesignSystem();
  const supabase = useChatClient();
  const stored = maxAttachmentMbOf(organizationJSON);
  const [text, setText] = useState(String(stored));
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  useEffect(() => setText(String(stored)), [stored]);
  const err = maxAttachmentError(text);
  const save = async () => {
    if (err) { setMessage(pmT(err)); setIsError(true); return; }
    const r = await chatSetMaxAttachmentSize(supabase, Number(text));
    setIsError(!r.ok);
    setMessage(r.ok ? pmT('Saved: {{mb}} MB.', { mb: r.data }) : r.error);
    if (r.ok) onSaved?.(r.data);
  };
  return (
    <View testID={testID} style={{ gap: 8 }}>
      <TextInputApp testID={`${testID}-max-size`} label={pmT('Biggest chat attachment, MB ({{key}})', { key: MAX_ATTACHMENT_KEY })} value={text} onChangeText={setText} keyboardType="numeric" error={!!err} errorMessage={err ? pmT(err) : undefined} />
      <Text style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>{pmT('From 1 to 100 MB (default 10). Only a project manager or an administrator can change it.')}</Text>
      <Pressable testID={`${testID}-save`} onPress={() => void save()} style={{ alignSelf: 'flex-start', backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>{pmT('Save the size')}</Text>
      </Pressable>
      {message ? <Text testID={`${testID}-message`} style={{ color: isError ? c.error : c.text }}>{message}</Text> : null}
    </View>
  );
}
