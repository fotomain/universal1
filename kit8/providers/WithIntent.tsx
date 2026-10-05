// WithIntent (mobile): receives what other apps share into this app - a link, text, pictures, video,
// files - with expo-share-intent, and puts it into Redux as uxui.intentInfo (kit8/redux/uxuiSlice.ts).
// The "what to add?" window (kit8/components/intent/IntentAddModalWindow.tsx, RadioSetApp) reads it.
// Same approach as expo-w1 mi/providers/WithIntent.tsx, without the debug views: the provider only
// listens; nothing is rendered here. Web: WithIntent.web.tsx (no share intents in a browser).
//
// Setup: plugin 'expo-share-intent' in app.config.js (Android intent filters, iOS share extension)
// + app/+native-intent.ts (expo-router). Needs a development / production build (not Expo Go).

import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { setIntentInfo } from '../redux/uxuiSlice';
import { buildIntentInfo } from '../components/intent/intentInfo';

function IntentToRedux() {
  const dispatch = useDispatch();
  const { hasShareIntent, isReady, shareIntent, resetShareIntent, error } = useShareIntentContext();

  useEffect(() => {
    if (!isReady || !hasShareIntent) return;
    const info = buildIntentInfo(shareIntent);
    if (info) dispatch(setIntentInfo(info));
    // taken over: the native side may forget it, so the same share is not handled twice
    resetShareIntent();
  }, [isReady, hasShareIntent, shareIntent, resetShareIntent, dispatch]);

  useEffect(() => {
    if (error) console.log('Share intent error:', error);
  }, [error]);

  return null;
}

const WithIntent = ({ children }: { children: React.ReactNode }) => (
  <ShareIntentProvider options={{ resetOnBackground: true }}>
    <IntentToRedux />
    {children}
  </ShareIntentProvider>
);

export default WithIntent;
