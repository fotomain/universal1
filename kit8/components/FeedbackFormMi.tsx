import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import H1Mi from '../ui/H1Mi';
import H2Mi from '../ui/H2Mi';
import ArticleTextMi from '../ui/ArticleTextMi';
import TextInputApp from '../../components/common/TextInputApp';
import ButtonPrimaryApp from '../../components/common/ButtonPrimaryApp';

export default function FeedbackFormMi() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = () => {
    Alert.alert('Feedback submitted', `Name: ${name}\nEmail: ${email}\nMessage: ${message}`);
  };

  return (
    <View style={styles.container}>
      <H1Mi>{t('menu.feedback')}</H1Mi>
      <H2Mi>{t('body.weValueInput')}</H2Mi>
      <ArticleTextMi>{t('body.feedbackDescription')}</ArticleTextMi>
      <TextInputApp label={t('body.yourName')} value={name} onChangeText={setName} placeholder={t('body.yourName')} />
      <TextInputApp label={t('screens.email')} value={email} onChangeText={setEmail} placeholder="your@email.com" keyboardType="email-address" />
      <TextInputApp
        label={t('body.yourFeedback')}
        value={message}
        onChangeText={setMessage}
        placeholder={t('body.yourFeedback')}
        multiline
        numberOfLines={4}
      />
      <ButtonPrimaryApp title={t('screens.submitFeedback')} onPress={handleSubmit} />
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 400,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    alignSelf: 'center',
  },
});
