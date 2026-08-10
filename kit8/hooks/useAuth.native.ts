import { useState, useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

const CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
  process.env.GOOGLE_CLIENT_ID ||
  '220875615440-1md07fq31vq7ilp0lod4vv3e8tvmup6l.apps.googleusercontent.com';
const REDIRECT_URI = AuthSession.makeRedirectUri({ scheme: 'myapp', path: 'auth' });
const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

import { saveUserData, clearUserData } from '../../kit8/lib/localSecureStorage';

export function useAuthWithGoogle() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    { clientId: CLIENT_ID, redirectUri: REDIRECT_URI, scopes: ['openid', 'profile', 'email'] },
    discovery
  );

  useEffect(() => {
    if (response) {
      if (response.type === 'success') {
        const { access_token } = response.params;
        setLoading(true);
        fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${access_token}` },
        })
          .then(res => res.json())
          .then(userInfo => {
            console.log('✅ Google Sign-In success (native)');
            console.log('User ID (sub):', userInfo.id);
            console.log('Email:', userInfo.email);
            setUser(userInfo);
            saveUserData(userInfo.id || '', userInfo.email || '');
            setLoading(false);
          })
          .catch(err => { console.error(err); setLoading(false); });
      } else if (response.type === 'error') {
        console.error('Auth error:', response.error?.message);
        setLoading(false);
      }
    }
  }, [response]);

  const signIn = () => { if (request) promptAsync(); };

  const signOutWithGoogle = async () => {
    setUser(null);
    await clearUserData();
    setLoading(false);
  };

  return { user, loading, signIn, signOutWithGoogle, signOut: signOutWithGoogle };
}

export const useAuth = useAuthWithGoogle;