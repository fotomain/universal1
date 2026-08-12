import React, { createContext, useContext, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { DesignSystemType, IconsVariant, setDesignSystem, setIconsVariant, toggleDarkMode } from '../redux/uxuiSlice';
import { toggleThemeMode } from '../redux/userThemeSlice';
import tamaguiConfig from '../../tamagui.config';
import loadMaterialWebCdn from '../../components/common/googlemd3web/loadMaterialWebCdn';

export type { DesignSystemType, IconsVariant };

export interface DesignSystemContextType {
  activeSystem: DesignSystemType;
  setActiveSystem: (system: DesignSystemType) => void;
  iconsVariant: IconsVariant;
  setIconsVariant: (variant: IconsVariant) => void;
  isDark: boolean;
  toggleTheme: () => void;
  tamaguiConfig: typeof tamaguiConfig;
  themeColors: {
    primary: string;
    background: string;
    surface: string;
    text: string;
    border: string;
    error: string;
    card: string;
  };
}

const defaultColorsLight = {
  primary: '#6366f1',
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  border: '#e2e8f0',
  error: '#ef4444',
  card: '#ffffff',
};

const defaultColorsDark = {
  primary: '#818cf8',
  background: '#0f172a',
  surface: '#1e293b',
  text: '#f8fafc',
  border: '#334155',
  error: '#f87171',
  card: '#1e293b',
};

const DesignSystemContext = createContext<DesignSystemContextType>({
  activeSystem: 'paper',
  setActiveSystem: () => {},
  iconsVariant: 'materialIconsOnly',
  setIconsVariant: () => {},
  isDark: false,
  toggleTheme: () => {},
  tamaguiConfig,
  themeColors: defaultColorsLight,
});

export const DesignSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useDispatch();

  // Consume Redux uxuiState and userTheme entities
  const uxuiState = useSelector((state: any) => state?.uxuiState);
  const userTheme = useSelector((state: any) => state?.userTheme);

  const activeSystem: DesignSystemType = uxuiState?.activeDesignSystem || 'paper';
  const iconsVariant: IconsVariant = uxuiState?.iconsVariant || 'materialIconsOnly';
  const isDark: boolean = userTheme?.isDark ?? uxuiState?.darkMode ?? false;

  React.useEffect(() => {
    if (activeSystem === 'googlemd3web') {
      loadMaterialWebCdn();
    }
  }, [activeSystem]);

  const handleSetSystem = (system: DesignSystemType) => {
    if (dispatch) {
      dispatch(setDesignSystem(system));
    }
  };

  const handleSetIconsVariant = (variant: IconsVariant) => {
    if (dispatch) {
      dispatch(setIconsVariant(variant));
    }
  };

  const handleToggleTheme = () => {
    if (dispatch) {
      dispatch(toggleDarkMode());
      dispatch(toggleThemeMode());
    }
  };

  const currentThemeColors = useMemo(() => {
    if (userTheme?.theme?.colors) {
      const c = userTheme.theme.colors;
      return {
        primary: c.primary || (isDark ? defaultColorsDark.primary : defaultColorsLight.primary),
        background: c.background || (isDark ? defaultColorsDark.background : defaultColorsLight.background),
        surface: c.surface || (isDark ? defaultColorsDark.surface : defaultColorsLight.surface),
        text: c.onBackground || c.text || (isDark ? defaultColorsDark.text : defaultColorsLight.text),
        border: c.outline || (isDark ? defaultColorsDark.border : defaultColorsLight.border),
        error: c.error || (isDark ? defaultColorsDark.error : defaultColorsLight.error),
        card: c.elevation?.level1 || c.surface || (isDark ? defaultColorsDark.card : defaultColorsLight.card),
      };
    }
    return isDark ? defaultColorsDark : defaultColorsLight;
  }, [isDark, userTheme]);

  const value = useMemo(
    () => ({
      activeSystem,
      setActiveSystem: handleSetSystem,
      iconsVariant,
      setIconsVariant: handleSetIconsVariant,
      isDark,
      toggleTheme: handleToggleTheme,
      tamaguiConfig,
      themeColors: currentThemeColors,
    }),
    [activeSystem, iconsVariant, isDark, currentThemeColors]
  );

  return (
    <DesignSystemContext.Provider value={value}>
      {children}
    </DesignSystemContext.Provider>
  );
};

export const useDesignSystem = (): DesignSystemContextType => {
  const context = useContext(DesignSystemContext);
  if (!context) {
    throw new Error('useDesignSystem must be used within a DesignSystemProvider');
  }
  return context;
};

export default DesignSystemContext;
