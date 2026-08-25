export interface TextAreaSubcomponentProps {
  label?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean | string | undefined;
  computedErrorMessage?: string;
  helperText?: string;
  numberOfLines?: number;
  themeColors: {
    primary: string;
    text: string;
    surface: string;
    border: string;
    error: string;
    [key: string]: string;
  };
  isDark?: boolean;
  style?: any;
  onClear?: () => void;
}
