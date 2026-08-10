import { useState } from 'react';
import { clearUserData } from '../../kit8/lib/localSecureStorage';

export function useAuthWithGoogle() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    console.log('Default auth fallback sign-in');
  };

  const signOutWithGoogle = async () => {
    setUser(null);
    await clearUserData();
    setLoading(false);
  };

  return { user, loading, signIn, signOutWithGoogle, signOut: signOutWithGoogle };
}

export const useAuth = useAuthWithGoogle;
