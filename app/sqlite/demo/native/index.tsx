import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, FlatList, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthWithGoogle } from '../../../../kit8/hooks/useAuth';
import { getUserData } from '../../../../kit8/lib/localSecureStorage';
import H1Mi from '../../../../kit8/ui/H1Mi';
import TexInputMi from '../../../../kit8/ui/TexInputMi';
import ButtonMi from '../../../../kit8/ui/ButtonMi';

interface Item {
  id: number;
  value: string;
}

export default function SQLiteNativeDemoScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user: googleUser } = useAuthWithGoogle();
  const isWeb = Platform.OS === 'web';

  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [db, setDb] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuthAndInit() {
      // Check user identity
      const stored = await getUserData();
      const rawUserId = googleUser?.id || stored.id;
      const isLoggedIn = !!rawUserId && (!!googleUser || !!stored.email);

      if (!isLoggedIn) {
        router.replace({
          pathname: '/stopscreen',
          params: {
            stopScreenMessage: t('screens.userMustBeLoggedIn'),
            goToSignIn: 'true',
            returnTo: '/sqlite/demo/native',
          },
        });
        return;
      }

      const safeUserId = rawUserId.replace(/[^a-zA-Z0-9_]/g, '_');
      setCurrentUserId(safeUserId);

      // Web Persistence using localStorage for user ID
      if (isWeb) {
        if (typeof window !== 'undefined' && window.localStorage) {
          const savedItems = window.localStorage.getItem(`sqlite_items_${safeUserId}`);
          if (savedItems) {
            try {
              setItems(JSON.parse(savedItems));
            } catch (e) {
              console.error('Error parsing stored web items:', e);
            }
          }
        }
        setLoading(false);
        return;
      }

      // Native Persistence using SQLite with user id db name (user_<userId>.db)
      try {
        const dbName = `user_${safeUserId}.db`;
        const SQLite = await import('expo-sqlite');
        const database = await SQLite.openDatabaseAsync(dbName);
        setDb(database);
        await database.execAsync(`
          CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            value TEXT NOT NULL
          );
        `);
        const result = (await database.getAllAsync('SELECT * FROM items ORDER BY id DESC;')) as Item[];
        setItems(result);
      } catch (e) {
        console.error('Error initializing user SQLite DB:', e);
      } finally {
        setLoading(false);
      }
    }

    checkAuthAndInit();
  }, [googleUser, isWeb]);

  const addItem = async () => {
    if (!text.trim()) return;
    const valueToAdd = text.trim();

    if (isWeb) {
      const newItem: Item = { id: Date.now(), value: valueToAdd };
      setItems(prev => {
        const next = [newItem, ...prev];
        if (typeof window !== 'undefined' && window.localStorage && currentUserId) {
          window.localStorage.setItem(`sqlite_items_${currentUserId}`, JSON.stringify(next));
        }
        return next;
      });
      setText('');
      return;
    }

    if (!db) return;
    try {
      await db.runAsync('INSERT INTO items (value) VALUES (?);', valueToAdd);
      setText('');
      const result = (await db.getAllAsync('SELECT * FROM items ORDER BY id DESC;')) as Item[];
      setItems(result);
    } catch (e) {
      console.error('Error adding item:', e);
    }
  };

  const deleteItem = async (id: number) => {
    if (isWeb) {
      setItems(prev => {
        const next = prev.filter(item => item.id !== id);
        if (typeof window !== 'undefined' && window.localStorage && currentUserId) {
          window.localStorage.setItem(`sqlite_items_${currentUserId}`, JSON.stringify(next));
        }
        return next;
      });
      return;
    }

    if (!db) return;
    try {
      await db.runAsync('DELETE FROM items WHERE id = ?;', id);
      const result = (await db.getAllAsync('SELECT * FROM items ORDER BY id DESC;')) as Item[];
      setItems(result);
    } catch (e) {
      console.error('Error deleting item:', e);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6200ee" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <H1Mi>{t('menu.sqliteDemo')}</H1Mi>

      <Text style={styles.dbInfoText}>
        Database: <Text style={styles.boldText}>{currentUserId ? `user_${currentUserId}.db` : 'demo.db'}</Text>
      </Text>

      {isWeb && (
        <View style={styles.webBanner}>
          <Text style={styles.webBannerText}>
            ℹ️ Running on Web: Data is persisted across browser reloads for User ID <Text style={styles.boldText}>{currentUserId}</Text>.
          </Text>
        </View>
      )}

      <TexInputMi
        label={t('screens.addItem')}
        value={text}
        onChangeText={setText}
        placeholder="Enter item text..."
        inputMode="nativePaper"
      />

      <ButtonMi title={t('screens.addItem')} onPress={addItem} />

      <Text style={styles.sectionHeader}>{t('screens.storedItems')}</Text>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <Text style={styles.itemText}>{item.value}</Text>
            <ButtonMi title={t('screens.deleteItem')} onPress={() => deleteItem(item.id)} color="#d32f2f" />
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>{t('screens.noItems')}</Text>}
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  dbInfoText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  boldText: {
    fontWeight: 'bold',
  },
  webBanner: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#90caf9',
  },
  webBannerText: {
    color: '#0d47a1',
    fontSize: 14,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 12,
  },
  list: {
    flex: 1,
    marginTop: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    marginVertical: 4,
  },
  itemText: {
    fontSize: 16,
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 20,
  },
});
