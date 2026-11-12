import React from 'react';
import ChatThemeScreen from '../../../kit8/chat/ChatThemeScreen';

// route /chat/theme?themeGUID=… (or ?taskGUID=… for the chat of a task) - one theme: messages + input
export default function ChatThemeRoute() {
  return <ChatThemeScreen />;
}
