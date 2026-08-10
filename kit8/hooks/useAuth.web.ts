import { useState, useEffect } from 'react';
import { supabase } from '../../kit8/supabase/supabase';
import { User } from '@supabase/supabase-js';
import { saveUserData, clearUserData } from '../../kit8/lib/localSecureStorage';

export function useAuthWithGoogle() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        console.log('✅ Google Sign-In success (web)');
        console.log('User ID (sub):', session.user.id);
        console.log('Email:', session.user.email);
        setUser(session.user);
        saveUserData(session.user.id, session.user.email || '');
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('✅ Google Sign-In success (web)');
        console.log('User ID (sub):', session.user.id);
        console.log('Email:', session.user.email);
        setUser(session.user);
        saveUserData(session.user.id, session.user.email || '');
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        clearUserData();
      }
    });
    return () => listener?.subscription.unsubscribe();
  }, []);

  const signIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/signin' },
    });
    if (error) { console.error(error.message); setLoading(false); }
  };

  const signOutWithGoogle = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    await clearUserData();
    setUser(null);
    setLoading(false);
  };

  return { user, loading, signIn, signOutWithGoogle, signOut: signOutWithGoogle };
}

export const useAuth = useAuthWithGoogle;