/** @jest-environment jsdom */
// The BIM tab of the Project settings: projectIsBIMBased is ALWAYS switchable (owner 2026-11-20); a read-only project locks it.
import React, { act } from 'react';
import { cleanupUI, q, renderUI, seedStore } from '../pm/ui/pmUiTestKit';

const mockSwitch = jest.fn();
jest.mock('../../kit8/providers/WithDesignSystem', () => ({ useDesignSystem: () => ({ themeColors: { text: '#000', primary: '#00f', background: '#fff', border: '#ccc' } }) }));
jest.mock('../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: { rpc: async () => ({ data: null, error: null }) } }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('../../kit8/ui/components/common/SwitchApp', () => ({ __esModule: true, default: (p: any) => { mockSwitch(p); return require('react').createElement(require('react-native').Pressable, { testID: p.testID, onPress: () => !p.disabled && p.onValueChange(!p.value), accessibilityState: { disabled: !!p.disabled, checked: p.value } }, null); } }));
jest.mock('../../kit8/ui/components/common/ButtonTextApp', () => ({ __esModule: true, default: (p: any) => require('react').createElement(require('react-native').Pressable, { testID: p.testID, onPress: p.onPress }, null) }));
jest.mock('../../kit8/pm/inner/PMApproveYesNoCancelModalWindow', () => ({ approvePM: async () => true }));

import PMProjectBimTab from '../../kit8/pm/view/project/settings/PMProjectBimTab';
import { usePMStore } from '../../kit8/pm/store/store_pm';

afterEach(() => { jest.clearAllMocks(); cleanupUI(); act(() => usePMStore.setState({ projectsById: {} } as any)); });
const last = () => mockSwitch.mock.calls[mockSwitch.mock.calls.length - 1][0];

describe('BIM tab: the switch', () => {
  it('a project with no model: the switch is off and ENABLED; pressing it asks the window to set projectIsBIMBased', () => {
    seedStore();
    const onChange = jest.fn();
    renderUI(<PMProjectBimTab projectGUID="p1" rowJSON={{}} values={{}} onChange={onChange} />);
    expect(last().value).toBe(false);
    expect(last().disabled).toBe(false);
    last().onValueChange(true);
    expect(onChange).toHaveBeenCalledWith({ projectIsBIMBased: true });
  });

  it('the switch shows the DRAFT (what the window will save), not the stored row', () => {
    seedStore();
    renderUI(<PMProjectBimTab projectGUID="p1" rowJSON={{ projectIsBIMBased: true }} values={{ projectIsBIMBased: false }} onChange={jest.fn()} />);
    expect(last().value).toBe(false);
  });

  it('a BIM project can be switched off', () => {
    seedStore();
    const onChange = jest.fn();
    renderUI(<PMProjectBimTab projectGUID="p1" rowJSON={{ projectIsBIMBased: true }} values={{ projectIsBIMBased: true }} onChange={onChange} />);
    expect(last().value).toBe(true);
    last().onValueChange(false);
    expect(onChange).toHaveBeenCalledWith({ projectIsBIMBased: false });
  });

  it('a read-only project locks the switch (nothing but the read-only switch may change there)', () => {
    seedStore();
    act(() => usePMStore.setState({ projectsById: { p1: { rowGUID: 'p1', rowJSON: { projectIsReadonly: true } } } } as any));
    renderUI(<PMProjectBimTab projectGUID="p1" rowJSON={{}} values={{}} onChange={jest.fn()} />);
    expect(last().disabled).toBe(true);
  });

  it('the Import button is there for a saved project', () => {
    seedStore();
    renderUI(<PMProjectBimTab projectGUID="p1" rowJSON={{}} values={{}} onChange={jest.fn()} />);
    expect(q('pm-project-bim-import')).not.toBeNull();
    expect(q('pm-project-bim-remove')).toBeNull();
  });
});

describe('BIM tab: Import closes the settings window first', () => {
  it('the Import button calls onOpenImporter (the host closes its window, then navigates)', () => {
    seedStore();
    const onOpenImporter = jest.fn();
    renderUI(<PMProjectBimTab projectGUID="p1" rowJSON={{}} values={{}} onChange={jest.fn()} onOpenImporter={onOpenImporter} />);
    act(() => { (q('pm-project-bim-import') as any).click(); });
    expect(onOpenImporter).toHaveBeenCalledTimes(1);
  });
});
