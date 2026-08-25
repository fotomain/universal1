import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { Appbar } from 'react-native-paper';
import { useNavigation, useRouter, usePathname } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { DrawerHeaderProps } from '@react-navigation/drawer';
import { useTranslation } from 'react-i18next';
import { useDesignSystem } from '../providers/WithDesignSystem';
import IconApp from '../components/common/IconApp';
import ArrowToLeftApp from '../components/common/ArrowToLeftApp';
import { useAppSignOut } from '../hooks/useAppSignOut';

export default function AppBar({ route, options }: DrawerHeaderProps) {
  const navigation = useNavigation();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { handleSignOut } = useAppSignOut();
  const { activeSystem, themeColors, isDark } = useDesignSystem();
  const title = options?.title || route?.name || t('menu.home');

  const [visible, setVisible] = useState(false);

  const isHome = pathname === '/home' || pathname === '/' || route?.name === 'home' || route?.name === 'index';

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  };

  const openMenu = () => setVisible(true);
  const closeMenu = () => setVisible(false);

  const handleSignIn = () => {
    closeMenu();
    router.push('/signin');
  };

  const handleSignUp = () => {
    closeMenu();
    router.push('/signup');
  };

  const onSignOutClick = async () => {
    closeMenu();
    await handleSignOut();
  };

  const handleSettings = () => {
    closeMenu();
    try {
      if ((router as any).navigate) {
        (router as any).navigate('/settings');
      } else {
        router.replace('/settings');
      }
    } catch (e) {
      router.replace('/settings');
    }
  };

  const handleDesigns = () => {
    closeMenu();
    try {
      if ((router as any).navigate) {
        (router as any).navigate('/kit8/designs');
      } else {
        router.replace('/kit8/designs');
      }
    } catch (e) {
      router.replace('/kit8/designs');
    }
  };

  const renderRightMenuOverlay = () => {
    if (!visible) return null;

    return (
      <Modal transparent visible={visible} animationType="fade" onRequestClose={closeMenu}>
        <Pressable style={styles.modalOverlay} onPress={closeMenu}>
          <View
            style={[
              styles.dropdownMenu,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.border,
                borderRadius: activeSystem === 'expo' ? 20 : activeSystem === 'tamagui' ? 14 : 8,
              },
            ]}
          >
            <TouchableOpacity style={styles.menuRow} onPress={handleSignIn}>
              <IconApp testID="ca805134-3hf1-8ij0-2sx4-567890123e35" name="login" size={18} color={themeColors.primary} style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 15, color: themeColors.text }}>{t('menu.signIn')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuRow} onPress={handleSignUp}>
              <IconApp testID="db916245-4ig2-9jk1-3ty5-678901234f36" name="account-plus" size={18} color={themeColors.primary} style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 15, color: themeColors.text }}>{t('menu.signUp')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuRow} onPress={onSignOutClick}>
              <IconApp testID="ec027356-5jh3-0kl2-4uz6-789012345a37" name="logout" size={18} color={themeColors.error} style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 15, color: themeColors.error }}>{t('menu.signOut')}</Text>
            </TouchableOpacity>

            <View style={{ height: 1, backgroundColor: themeColors.border, marginVertical: 4 }} />

            <TouchableOpacity style={styles.menuRow} onPress={handleDesigns}>
              <IconApp testID="fd138467-6ki4-1lm3-5va7-890123456b38" name="palette" size={18} color={themeColors.primary} style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 15, color: themeColors.text }}>Kit8 Designs</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuRow} onPress={handleSettings}>
              <IconApp testID="ae249578-7lj5-2mn4-6wb8-901234567c39" name="settings" size={18} color={themeColors.primary} style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 15, color: themeColors.text }}>{t('menu.settings')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    );
  };

  const handleOpenDrawer = () => {
    try {
      navigation.dispatch(DrawerActions.openDrawer());
    } catch (e) {
      try {
        (navigation as any)?.openDrawer?.();
      } catch (err) {
        try {
          (navigation as any)?.toggleDrawer?.();
        } catch (e2) {}
      }
    }
  };

  switch (activeSystem) {
    case 'paper': {
      return (
        <Appbar.Header elevated style={{ backgroundColor: themeColors.surface }}>
          <Appbar.Action icon="menu" onPress={handleOpenDrawer} />
          {!isHome && (
            <Appbar.Action
              icon="arrow-left"
              onPress={handleBack}
            />
          )}
          <Appbar.Content title={title} />
          <TouchableOpacity onPress={visible ? closeMenu : openMenu} style={styles.actionBtn}>
            <IconApp testID="bf350689-8mk6-3no5-7xc9-012345678d40" name={visible ? 'close' : 'more_vert'} size={22} color={themeColors.text} />
          </TouchableOpacity>
          {renderRightMenuOverlay()}
        </Appbar.Header>
      );
    }

    case 'tamagui':
    case 'expo':
    case 'ant':
    case 'native':
    default: {
      return (
        <View
          style={[
            styles.headerContainer,
            {
              backgroundColor: themeColors.surface,
              borderBottomColor: themeColors.border,
              borderBottomWidth: activeSystem === 'ant' ? 1 : 0.5,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <div
              onClick={handleOpenDrawer}
              style={{
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TouchableOpacity
                onPress={handleOpenDrawer}
                style={styles.actionBtn}
              >
                <IconApp testID="cg461790-9nl7-4op6-8yd0-123456789e41" name="menu" size={22} color={themeColors.text} onPress={handleOpenDrawer} />
              </TouchableOpacity>
            </div>

            {!isHome && (
              <TouchableOpacity onPress={handleBack} style={styles.actionBtn}>
                <ArrowToLeftApp size={22} color={themeColors.text} />
              </TouchableOpacity>
            )}

            <Text
              style={{
                fontSize: 18,
                fontWeight: '700',
                color: themeColors.text,
                marginLeft: 8,
              }}
            >
              {title}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={openMenu} style={styles.actionBtn}>
              <IconApp testID="dh5728a1-0om8-5pq7-9ze1-234567890f42" name={visible ? 'close' : 'more_vert'} size={22} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          {renderRightMenuOverlay()}
        </View>
      );
    }
  }
}

const styles = StyleSheet.create({
  headerContainer: {
    height: 56,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 3,
    boxShadow: '0px 2px 8px rgba(0,0,0,0.06)',
  },
  actionBtn: {
    padding: 8,
    borderRadius: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 56,
    paddingRight: 12,
  },
  dropdownMenu: {
    width: 200,
    paddingVertical: 8,
    borderWidth: 1,
    boxShadow: '0px 4px 16px rgba(0,0,0,0.2)',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
});
