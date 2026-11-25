// The look of the text and of the cells of a ReusableTable that belongs to a dashboard (userSettingsTable: rowJSON.uxuiState.extendedSettings, the fonts of the header and of the data cell, the
// cell background). A table without `dashboard` has no provider: the context is empty and nothing changes.
import { createContext, useContext, useContext as useCtx, useSyncExternalStore } from 'react';
import { ReactReduxContext } from 'react-redux';
import { Platform } from 'react-native';
import { selectExtendedSettings } from '../../../../redux/uxuiSlice';
import { ExtendedSettings, TRANSPARENT } from '../../../../catalog/user/settings/userSettingsModel';
import { themeFontStyle, ThemeFontStyle } from '../../../fonts/useThemeFont';
import { useAppFonts } from '../../../fonts/useAppFonts';

export interface TableStyle {
  header?: ThemeFontStyle;
  cell?: ThemeFontStyle;
  /** a color the user chose for the cells; undefined = transparent = the table keeps its own look */
  cellBackground?: string;
}

export const TableStyleContext = createContext<TableStyle>({});
export const useTableStyle = (): TableStyle => useContext(TableStyleContext);

const noop = () => () => {};

/** the table style of one dashboard (the hooks run in a fixed order, also without a dashboard) */
export function useDashboardTableStyle(dashboard: keyof ExtendedSettings | undefined): TableStyle {
  const ctx = useCtx(ReactReduxContext) as any;
  const store = ctx?.store;
  const all = useSyncExternalStore(store ? store.subscribe : noop, () => (store ? selectExtendedSettings(store.getState()) : null) as any, () => null as any);
  const d = dashboard && all ? all[dashboard] : null;
  const headerReady = useAppFonts(d?.header.fontName ?? 'system');
  const cellReady = useAppFonts(d?.dataCell.fontName ?? 'system');
  if (!d) return EMPTY;
  const web = Platform.OS === 'web';
  return {
    header: themeFontStyle(d.header.fontName, d.header.fontSize, 'header', d.header.fontWeight, headerReady, web),
    cell: themeFontStyle(d.dataCell.fontName, d.dataCell.fontSize, 'body', d.dataCell.fontWeight, cellReady, web),
    cellBackground: d.cellBackground && d.cellBackground !== TRANSPARENT ? d.cellBackground : undefined,
  };
}
const EMPTY: TableStyle = {};
