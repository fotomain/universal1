import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { TextInput as PaperTextInput, Text, Surface, IconButton, useTheme } from 'react-native-paper';
import { LANGUAGES, LanguageItem, changeAppLanguage } from '../i18n/i18n';
import { getUserSettings, saveUserSettings } from '../settings/userSettings';
import { useAuthWithGoogle } from '../hooks/useAuth';
import { getUserData } from '../lib/localSecureStorage';

export interface LanguageSelectorProps {
  onSelectLanguage?: () => void;
}

export default function LanguageSelectorComponent({ onSelectLanguage }: LanguageSelectorProps) {
  const theme = useTheme();
  const { user: googleUser } = useAuthWithGoogle();
  const [userGUID, setUserGUID] = useState<string>('guest');
  const [currentLang, setCurrentLang] = useState<LanguageItem>(LANGUAGES[0]);
  const [inputText, setInputText] = useState<string>('EN - English');
  const [filterText, setFilterText] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>(undefined);
  const inputRef = useRef<any>(null);
  const inputTextRef = useRef(inputText);
  inputTextRef.current = inputText;

  useEffect(() => {
    async function loadSettings() {
      const storedData = await getUserData();
      const guid = googleUser?.id || storedData.id || 'guest';
      setUserGUID(guid);

      const settings = await getUserSettings(guid);
      const found = LANGUAGES.find(l => l.code === settings.userLanguage) || LANGUAGES[0];
      setCurrentLang(found);
      setInputText(`${found.abbr} - ${found.name}`);
      changeAppLanguage(found.code);
    }
    loadSettings();
  }, [googleUser]);

  // Ensure English is set if input is empty when exiting/closing menu
  const ensureEnglishIfEmpty = async () => {
    if (!inputTextRef.current.trim()) {
      const englishLang = LANGUAGES.find(l => l.code === 'en') || LANGUAGES[0];
      setCurrentLang(englishLang);
      setInputText(`${englishLang.abbr} - ${englishLang.name}`);
      setFilterText('');
      await changeAppLanguage(englishLang.code);
      await saveUserSettings({
        userGUID,
        userLanguage: englishLang.code,
      });
    }
  };

  // On component unmount / drawer close: ensure English if empty
  useEffect(() => {
    return () => {
      ensureEnglishIfEmpty();
    };
  }, [userGUID]);

  // Restrict input to letters and spaces only when typing
  const handleInputChange = (text: string) => {
    setSelection(undefined);
    const lettersOnly = text.replace(/[^a-zA-Z\s]/g, '');
    setInputText(lettersOnly);
    setFilterText(lettersOnly);
    setShowDropdown(true);
  };

  // Clear button press handler: empties input text, focuses cursor into field, and keeps dropdown visible
  const handleClearText = () => {
    setSelection(undefined);
    setInputText('');
    setFilterText('');
    setShowDropdown(true);
    inputRef.current?.focus();
  };

  // Arrow button press handler: toggles dropdown, shows all languages, focuses input and selects all text content
  const handleArrowPress = () => {
    setFilterText('');
    setShowDropdown(!showDropdown);
    inputRef.current?.focus();
    if (inputText) {
      setSelection({ start: 0, end: inputText.length });
    }
  };

  // Focusing input shows all languages initially
  const handleFocus = () => {
    setFilterText('');
    setShowDropdown(true);
  };

  // Handle blur / exit from input field: if input text is empty, default to English automatically
  const handleBlur = () => {
    setSelection(undefined);
    setTimeout(async () => {
      await ensureEnglishIfEmpty();
      setShowDropdown(false);
    }, 200);
  };

  // Filter list by filterText substring
  const filteredLanguages = LANGUAGES.filter(item => {
    const search = filterText.toLowerCase().trim();
    if (!search) return true;
    return (
      item.abbr.toLowerCase().includes(search) ||
      item.name.toLowerCase().includes(search) ||
      (item.speakers && item.speakers.toLowerCase().includes(search)) ||
      `${item.abbr} - ${item.name}`.toLowerCase().includes(search)
    );
  });

  const handleSelectLanguage = async (item: LanguageItem) => {
    setSelection(undefined);
    setCurrentLang(item);
    setInputText(`${item.abbr} - ${item.name}`);
    setFilterText('');
    setShowDropdown(false);
    await changeAppLanguage(item.code);

    await saveUserSettings({
      userGUID,
      userLanguage: item.code,
    });

    // Close left side drawer menu when user selects a language
    if (onSelectLanguage) {
      onSelectLanguage();
    }
  };

  // Handle Enter key press: pick 1st element from the filtered list
  const handleSubmitEditing = () => {
    if (filteredLanguages.length > 0) {
      handleSelectLanguage(filteredLanguages[0]);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.inputWrapper}>
        <PaperTextInput
          ref={inputRef}
          label="Language"
          value={inputText}
          selection={selection}
          onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
          onChangeText={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={handleSubmitEditing}
          mode="outlined"
          contentStyle={styles.inputContent}
          style={[styles.input, { backgroundColor: theme.colors.surface }]}
        />
        <View style={styles.absoluteIconRow}>
          <IconButton
            icon="close"
            size={20}
            onPress={handleClearText}
            style={styles.iconBtn}
          />
          <IconButton
            icon={showDropdown ? 'chevron-up' : 'chevron-down'}
            size={20}
            onPress={handleArrowPress}
            style={styles.iconBtn}
          />
        </View>
      </View>

      {showDropdown && (
        <Surface style={[styles.dropdown, { backgroundColor: theme.colors.surface }]} elevation={3}>
          <FlatList
            data={filteredLanguages}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 216 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.itemRow,
                  item.code === currentLang.code && styles.selectedRow,
                ]}
                onPress={() => handleSelectLanguage(item)}
              >
                <View style={styles.textWrapper}>
                  <View style={styles.titleRow}>
                    <Text style={styles.itemAbbr}>{item.abbr}</Text>
                    <Text style={styles.itemName}> - {item.name}</Text>
                  </View>
                  {item.speakers && (
                    <Text style={styles.speakersText}>{item.speakers}</Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>No matching language</Text>
              </View>
            }
          />
        </Surface>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    // backgroundColor will be set dynamically from theme
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    // backgroundColor will be set dynamically from theme
  },
  inputContent: {
    paddingRight: 76,
  },
  absoluteIconRow: {
    position: 'absolute',
    right: 4,
    top: 4,
    bottom: 0,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  iconBtn: {
    margin: 0,
    width: 32,
    height: 32,
  },
  dropdown: {
    marginTop: 4,
    borderRadius: 4,
    // backgroundColor will be set dynamically from theme
    maxHeight: 216,
  },
  itemRow: {
    padding: 10,
  },
  selectedRow: {
    backgroundColor: '#e8f0fe',
  },
  textWrapper: {
    flexDirection: 'column',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemAbbr: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#6200ee',
  },
  itemName: {
    fontSize: 14,
    color: '#333',
  },
  speakersText: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  emptyRow: {
    padding: 12,
    alignItems: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: 13,
  },
});
