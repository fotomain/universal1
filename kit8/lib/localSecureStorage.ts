import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { ActiveUserState, formatTo32CharGUID } from '../redux/activeUserSlice';

export interface StoredUserData extends ActiveUserState {
  id: string; /* userGUID32 */
  email: string;
}

export async function saveUserData(
  id: string,
  email: string,
  firstName: string = '',
  lastName: string = ''
) {
  /* userGUID32 */
  const activeUserGUID = formatTo32CharGUID(id); /* userGUID32 */
  const stateToSave: ActiveUserState = {
    activeUserGUID, /* userGUID32 */
    activeUserEmail: email,
    activeUserFirstName: firstName,
    activeUserLastName: lastName,
  };

  try {
    const jsonValue = JSON.stringify(stateToSave);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('active_user_state', jsonValue);
        window.localStorage.setItem('user_id', activeUserGUID); /* userGUID32 */
        window.localStorage.setItem('user_email', email);
        window.localStorage.setItem('user_first_name', firstName);
        window.localStorage.setItem('user_last_name', lastName);
      }
    } else {
      await SecureStore.setItemAsync('active_user_state', jsonValue);
      await SecureStore.setItemAsync('user_id', activeUserGUID); /* userGUID32 */
      await SecureStore.setItemAsync('user_email', email);
      await SecureStore.setItemAsync('user_first_name', firstName);
      await SecureStore.setItemAsync('user_last_name', lastName);
    }
  } catch (e) {
    console.error('Error saving active user state data to secure store:', e);
  }
}

export async function getUserData(): Promise<StoredUserData> {
  try {
    let jsonStr = '';
    let id = '';
    let email = '';
    let firstName = '';
    let lastName = '';

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        jsonStr = window.localStorage.getItem('active_user_state') || '';
        id = window.localStorage.getItem('user_id') || '';
        email = window.localStorage.getItem('user_email') || '';
        firstName = window.localStorage.getItem('user_first_name') || '';
        lastName = window.localStorage.getItem('user_last_name') || '';
      }
    } else {
      jsonStr = (await SecureStore.getItemAsync('active_user_state')) || '';
      id = (await SecureStore.getItemAsync('user_id')) || '';
      email = (await SecureStore.getItemAsync('user_email')) || '';
      firstName = (await SecureStore.getItemAsync('user_first_name')) || '';
      lastName = (await SecureStore.getItemAsync('user_last_name')) || '';
    }

    if (jsonStr) {
      const parsed = JSON.parse(jsonStr) as ActiveUserState;
      const activeUserGUID = formatTo32CharGUID(parsed.activeUserGUID || id); /* userGUID32 */
      const activeUserEmail = parsed.activeUserEmail || email;
      const activeUserFirstName = parsed.activeUserFirstName || firstName;
      const activeUserLastName = parsed.activeUserLastName || lastName;

      return {
        id: activeUserGUID, /* userGUID32 */
        email: activeUserEmail,
        activeUserGUID, /* userGUID32 */
        activeUserEmail,
        activeUserFirstName,
        activeUserLastName,
      };
    }

    /* userGUID32 */
    const activeUserGUID = formatTo32CharGUID(id); /* userGUID32 */
    return {
      id: activeUserGUID, /* userGUID32 */
      email,
      activeUserGUID, /* userGUID32 */
      activeUserEmail: email,
      activeUserFirstName: firstName,
      activeUserLastName: lastName,
    };
  } catch (e) {
    console.error('Error getting active user state data from secure store:', e);
    const activeUserGUID = formatTo32CharGUID(''); /* userGUID32 */
    return {
      id: activeUserGUID, /* userGUID32 */
      email: '',
      activeUserGUID, /* userGUID32 */
      activeUserEmail: '',
      activeUserFirstName: '',
      activeUserLastName: '',
    };
  }
}

export async function clearUserData() {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('active_user_state');
        window.localStorage.removeItem('user_id');
        window.localStorage.removeItem('user_email');
        window.localStorage.removeItem('user_first_name');
        window.localStorage.removeItem('user_last_name');
      }
    } else {
      await SecureStore.deleteItemAsync('active_user_state');
      await SecureStore.deleteItemAsync('user_id');
      await SecureStore.deleteItemAsync('user_email');
      await SecureStore.deleteItemAsync('user_first_name');
      await SecureStore.deleteItemAsync('user_last_name');
    }
  } catch (e) {
    console.error('Error clearing user data from secure store:', e);
  }
}

// Theme storage functions
export async function saveUserTheme(themeData: any) {
  try {
    const jsonValue = JSON.stringify(themeData);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('user_theme', jsonValue);
      }
    } else {
      await SecureStore.setItemAsync('user_theme', jsonValue);
    }
  } catch (e) {
    console.error('Error saving user theme to secure store:', e);
  }
}

export async function getUserTheme(): Promise<any | null> {
  try {
    let jsonStr = '';
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        jsonStr = window.localStorage.getItem('user_theme') || '';
      }
    } else {
      jsonStr = (await SecureStore.getItemAsync('user_theme')) || '';
    }

    if (jsonStr) {
      return JSON.parse(jsonStr);
    }
    return null;
  } catch (e) {
    console.error('Error getting user theme from secure store:', e);
    return null;
  }
}

export async function clearUserTheme() {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('user_theme');
      }
    } else {
      await SecureStore.deleteItemAsync('user_theme');
    }
  } catch (e) {
    console.error('Error clearing user theme from secure store:', e);
  }
}
