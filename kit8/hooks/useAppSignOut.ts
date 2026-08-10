import { useDispatch } from 'react-redux';
import { useRouter } from 'expo-router';
import { useAuthWithGoogle } from './useAuth';
import { SystemMetaData } from '../redux/SystemMetaData';
import { clearActiveUser } from '../redux/activeUserSlice';
import { saveUserData } from '../lib/localSecureStorage';

export const useAppSignOut = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const { signOutWithGoogle, loading } = useAuthWithGoogle();

  const handleSignOut = async () => {
    // 1. Trigger Supabase / Google Sign out logic
    await signOutWithGoogle();
    
    // 2. Clear Redux state for mediaPostReusable
    if (SystemMetaData?.['mediaPostReusable']?.actions?.clearData) {
      dispatch(SystemMetaData['mediaPostReusable'].actions.clearData());
    }

    // 3. Clear Active User state and local storage
    dispatch(clearActiveUser());
    saveUserData('', '', '', '');

    // 4. Route to signin page
    router.replace('/signin');
  };

  return { handleSignOut, loading };
};
