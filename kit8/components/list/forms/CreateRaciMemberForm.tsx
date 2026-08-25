import React, {useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {RadioButton, Surface, Text, useTheme} from 'react-native-paper';

import TexInputMi from '../../../ui/TexInputMi';
import {PronounType} from '../../../types/pronoun';
import {FormErrorFieldComponent} from './FormErrorFieldComponent';
import {ButtonPrimaryApp, ButtonSecondaryApp} from '../../common';

export interface CreateRaciMemberFormProps {
  onCreateLast?: (originParam?: any, manipulationParam?: any, originUrlParam?: string, customJson?: any) => void;
  onClose?: () => void;
  createErrorData?: string | null;
}

export function CreateRaciMemberForm({
  onCreateLast,
  onClose,
  createErrorData,
}: CreateRaciMemberFormProps) {
  const theme = useTheme();

  const [raciEmail, setRaciEmail] = useState('');
  const [raciFirstName, setRaciFirstName] = useState('');
  const [raciLastName, setRaciLastName] = useState('');
  const [pronoun, setPronoun] = useState<PronounType | ''>('');
  const [birthday, setBirthday] = useState('');

  const [errors, setErrors] = useState<{ email?: string; firstName?: string }>({});

  const validate = () => {
    const newErrors: { email?: string; firstName?: string } = {};

    if (!raciEmail.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raciEmail)) {
      newErrors.email = 'Invalid email format';
    }

    if (!raciFirstName.trim()) {
      newErrors.firstName = 'First name is required';
    } else if (raciFirstName.length < 2) {
      newErrors.firstName = 'First name is too short';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = () => {
    if (!validate()) return;

    if (onCreateLast) {
      onCreateLast(
        undefined,
        undefined,
        undefined,
        {
          raciEmail: raciEmail.trim().toLowerCase(),
          raciFirstName: raciFirstName.trim(),
          raciLastName: raciLastName.trim(),
          pronoun,
          birthday: birthday.trim(),
        }
      );
    }
  };

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.surface }]} elevation={2}>
      <Text style={[styles.title, { color: theme.colors.primary }]}>Create User (RACI)</Text>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.fieldWrap}>
          <TexInputMi
            label="Email *"
            value={raciEmail}
            onChangeText={(text) => {
              setRaciEmail(text);
              if (errors.email) {
                const isValid = text.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
                if (isValid) setErrors((prev) => ({ ...prev, email: undefined }));
              }
            }}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          {errors.email && (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>{errors.email}</Text>
          )}
        </View>

        <View style={styles.fieldWrap}>
          <TexInputMi
            label="First Name *"
            value={raciFirstName}
            onChangeText={(text) => {
              setRaciFirstName(text);
              if (errors.firstName) {
                const isValid = text.trim().length >= 2;
                if (isValid) setErrors((prev) => ({ ...prev, firstName: undefined }));
              }
            }}
          />
          {errors.firstName && (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>{errors.firstName}</Text>
          )}
        </View>

        <TexInputMi
          label="Last Name"
          value={raciLastName}
          onChangeText={setRaciLastName}
        />

        <View style={styles.radioGroup}>
          <Text style={{ color: theme.colors.onSurface, marginBottom: 4 }}>Pronoun</Text>
          <RadioButton.Group onValueChange={value => setPronoun(value as PronounType)} value={pronoun}>
            <View style={styles.radioRow}><RadioButton value={PronounType.HE_HIM} /><Text>He / Him</Text></View>
            <View style={styles.radioRow}><RadioButton value={PronounType.SHE_HER} /><Text>She / Her</Text></View>
            <View style={styles.radioRow}><RadioButton value={PronounType.THEY_THEM} /><Text>They / Them</Text></View>
            <View style={styles.radioRow}><RadioButton value={PronounType.OTHER} /><Text>Other</Text></View>
            <View style={styles.radioRow}><RadioButton value={PronounType.NO_PREFERENCE} /><Text>Prefer not to say</Text></View>
          </RadioButton.Group>
        </View>

        <TexInputMi
          label="Birthday (YYYY-MM-DD)"
          value={birthday}
          onChangeText={setBirthday}
        />

        <FormErrorFieldComponent error={createErrorData} />
      </ScrollView>

      <View style={styles.buttonRow}>
        {onClose && (
          <ButtonSecondaryApp onPress={onClose}>
            Cancel
          </ButtonSecondaryApp>
        )}
        <ButtonPrimaryApp onPress={handleCreate}>
          Create User
        </ButtonPrimaryApp>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    marginBottom: 8,
  },
  scrollContent: {
    gap: 0,
  },
  fieldWrap: {
    position: 'relative',
    marginBottom: 12,
  },
  radioGroup: {
    marginVertical: 2,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 8,
  },
  errorText: {
    fontSize: 11,
    position: 'absolute',
    bottom: -14,
    left: 4,
  }
});
