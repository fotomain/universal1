// The font of a dashboard for the Skia canvases (tree, estimate grid): the choice of the user -> the file + size the canvas draws with.
import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { DashboardFontScope, skiaFontPlan, useSkiaFontPlan } from '../../../kit8/pm/skia/dashboardFont';
import { defaultExtendedSettings } from '../../../kit8/catalog/user/settings/userSettingsModel';

describe('skiaFontPlan', () => {
  it('system: the system font of the browser at the scale size, the canvas font at 12 / 11 px without it', () => {
    const p = skiaFontPlan({ fontName: 'system', fontSize: 'medium' }, { fontName: 'system', fontSize: 'medium', fontWeight: 500 });
    expect(p.regular).toEqual({ file: null, size: 14, system: 'regular', fallbackSize: 12 });
    expect(p.bold).toEqual({ file: null, size: 14, system: 'bold', fallbackSize: 12 });
    expect(p.small).toEqual({ file: null, size: 13, system: 'regular', fallbackSize: 11 });
    expect(p.header).toEqual({ file: null, size: 14, system: 'medium', fallbackSize: 12 });
  });
  it('Roboto medium: data 400 / bold 700 at 14 px, small 13 px, header Roboto Medium', () => {
    const p = skiaFontPlan({ fontName: 'roboto', fontSize: 'medium' }, { fontName: 'roboto', fontSize: 'medium', fontWeight: 500 })!;
    expect(p.regular).toMatchObject({ file: 'Roboto_400Regular', size: 14 });
    expect(p.bold).toMatchObject({ file: 'Roboto_700Bold', size: 14 });
    expect(p.small).toMatchObject({ file: 'Roboto_400Regular', size: 13 });
    expect(p.smallBold).toMatchObject({ file: 'Roboto_700Bold', size: 13 });
    expect(p.header).toMatchObject({ file: 'Roboto_500Medium', size: 14 });
  });
  it('the size follows the choice', () => {
    const p = skiaFontPlan({ fontName: 'inter', fontSize: 'small' }, { fontName: 'inter', fontSize: 'large', fontWeight: 500 })!;
    expect(p.regular.size).toBe(12);
    expect(p.header).toMatchObject({ file: 'Inter_500Medium', size: 16 });
  });
  it('only the header chosen: the data cells stay on the canvas font', () => {
    const p = skiaFontPlan({ fontName: 'system', fontSize: 'medium' }, { fontName: 'roboto', fontSize: 'medium', fontWeight: 500 })!;
    expect(p.regular.file).toBeNull();
    expect(p.regular.system).toBe('regular');
    expect(p.header.file).toBe('Roboto_500Medium');
  });
});

describe('DashboardFontScope', () => {
  it('without a store (a unit test) there is no plan', async () => {
    const wrapper = ({ children }: any) => <DashboardFontScope dashboard="estimationDashboard">{children}</DashboardFontScope>;
    const { result } = await renderHook(() => useSkiaFontPlan(), { wrapper });
    expect(result.current).toBeNull();
  });
  it('reads the choice of the dashboard from the store', async () => {
    const { ReactReduxContext } = require('react-redux');
    const { extendedSettingsToJSON } = require('../../../kit8/catalog/user/settings/userSettingsModel');
    const ext = defaultExtendedSettings();
    ext.estimationDashboard.dataCell.fontName = 'roboto';
    const raw = extendedSettingsToJSON(ext);
    const store = { subscribe: () => () => {}, getState: () => ({ uxuiState: { extendedSettings: raw } }), dispatch: () => undefined };
    const wrapper = ({ children }: any) => (
      <ReactReduxContext.Provider value={{ store } as any}><DashboardFontScope dashboard="estimationDashboard">{children}</DashboardFontScope></ReactReduxContext.Provider>
    );
    const { result } = await renderHook(() => useSkiaFontPlan(), { wrapper });
    expect(result.current?.regular).toMatchObject({ file: 'Roboto_400Regular', size: 14 });
    // the other dashboard keeps its own (default = system) choice
    const w2 = ({ children }: any) => (
      <ReactReduxContext.Provider value={{ store } as any}><DashboardFontScope dashboard="projectDashboard">{children}</DashboardFontScope></ReactReduxContext.Provider>
    );
    expect((await renderHook(() => useSkiaFontPlan(), { wrapper: w2 })).result.current?.regular.system).toBe('regular');
  });
});
