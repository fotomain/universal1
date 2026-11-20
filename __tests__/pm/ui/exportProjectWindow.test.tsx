/** @jest-environment jsdom */
// kit8/pm/crud/exchange/project/PMExportProjectWindow: the Export window of the Import / Export button - options, a progress bar while it runs, locked until finished.
import { act } from 'react';
import { cleanupUI, press, q, renderUI, seedStore, textOf } from './pmUiTestKit';

let mockStatus: any = { kind: 'idle' };
const mockExport = jest.fn(async () => null);
const mockCancel = jest.fn();
jest.mock('../../../kit8/pm/crud/exchange/project/useProjectExchange', () => ({
  useProjectExchange: () => ({ exportProject: mockExport, cancelExport: mockCancel, importProject: jest.fn(), status: mockStatus, busy: mockStatus.kind === 'busy' }),
}));
jest.mock('../../../kit8/ui/components/common/SwitchApp', () => ({
  __esModule: true,
  default: (p: any) => require('react').createElement(require('react-native').Pressable, { testID: p.testID, onPress: () => !p.disabled && p.onValueChange(!p.value) }, null),
}));
jest.mock('../../../kit8/pm/crud/exchange/msproject/PMExportToMSProject', () => ({ __esModule: true, default: () => null }));

import React from 'react';
import PMExportProjectWindow, { addStep } from '../../../kit8/pm/crud/exchange/project/PMExportProjectWindow';
import { usePMStore } from '../../../kit8/pm/store/store_pm';

afterEach(() => { cleanupUI(); jest.clearAllMocks(); mockStatus = { kind: 'idle' }; });

const render = (guid: string, props: any = {}) => renderUI(<PMExportProjectWindow visible projectGUID={guid} ownerGUID="o" onClose={props.onClose ?? jest.fn()} {...props} />);

describe('PMExportProjectWindow', () => {
  it('addStep: the same running step is listed once', () => {
    expect(addStep([], 'a')).toEqual(['a']);
    expect(addStep(['a'], 'a')).toEqual(['a']);
    expect(addStep(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('shows the options and the file name; no progress before Export', () => {
    const { demo } = seedStore();
    render(demo.projects[0].rowGUID);
    expect(q('pm-export-project-window')).not.toBeNull();
    expect(q('pm-export-project-opt-lines')).not.toBeNull();
    expect(q('pm-export-project-opt-bim')).toBeNull(); // not a BIM project
    expect(textOf('pm-export-project-file-name')).toBe(`project_data_${demo.projects[0].rowGUID}.json`);
    expect(textOf('pm-export-project-format-title')).toBe('JSON file');
    expect(q('pm-export-project-format-content')).toBeNull();
    expect(q('pm-export-project-progress')).toBeNull();
  });

  it('Export runs exportProject with the options; BIM properties are ON by default for a BIM project', () => {
    const { demo } = seedStore();
    const P = demo.projects[0].rowGUID;
    const s = usePMStore.getState();
    usePMStore.setState({ projectsById: { ...s.projectsById, [P]: { ...s.projectsById[P], rowJSON: { ...s.projectsById[P].rowJSON, projectIsBIMBased: true } } } } as any);
    render(P);
    expect(q('pm-export-project-opt-bim-props')).not.toBeNull();
    expect(textOf('pm-export-project-file-name')).toBe(`project_package_${P}.zip`);
    expect(textOf('pm-export-project-format-title')).toBe('ZIP archive with the BIM model');
    expect(textOf('pm-export-project-format-content')).toContain('properties');
    expect(textOf('pm-export-project-export')).toContain('Export ZIP');
    press('pm-export-project-opt-bim-props'); // off: the zip says it carries no properties
    expect(textOf('pm-export-project-format-content')).not.toContain('properties');
    press('pm-export-project-opt-bim-props');
    press('pm-export-project-export');
    expect(mockExport).toHaveBeenCalledWith(P, { taskLines: true, bim: true, bimProperties: true });
  });

  it('while it runs: progress bar + steps, everything locked, no Close; when done: result + Close', async () => {
    const { demo } = seedStore();
    const P = demo.projects[0].rowGUID;
    const onClose = jest.fn();
    mockStatus = { kind: 'busy', text: 'Reading the project…', fraction: 0.05 };
    const view = render(P, { onClose });
    press('pm-export-project-export'); // starts (the hook is mocked: status stays busy)
    await act(async () => { await Promise.resolve(); });
    expect(q('pm-export-project-progress')).not.toBeNull();
    expect(textOf('pm-export-project-percent')).toBe('5 %');
    expect(textOf('pm-export-project-step-0')).toContain('Reading the project…');
    press('pm-export-project-close');
    expect(textOf('pm-export-project-cancel')).toContain('Cancel export');
    mockCancel.mockClear();
    press('pm-export-project-cancel'); // while it runs: stops the export, does not close the window
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    // finished
    mockStatus = { kind: 'done', text: 'Exported project_data_x.json (3 tasks).' };
    view.rerender?.(<PMExportProjectWindow visible projectGUID={P} ownerGUID="o" onClose={onClose} />);
    await act(async () => { await Promise.resolve(); });
    expect(textOf('pm-export-project-percent')).toBe('100 %');
    expect(textOf('pm-export-project-status')).toContain('Export successfully finished');
    press('pm-export-project-done');
    expect(onClose).toHaveBeenCalled();
  });

  it('a cancelled export: no file, message, Try again', async () => {
    const { demo } = seedStore();
    const P = demo.projects[0].rowGUID;
    mockStatus = { kind: 'busy', text: 'Reading the project…', fraction: 0.05 };
    const view = render(P, {});
    press('pm-export-project-export');
    await act(async () => { await Promise.resolve(); });
    mockStatus = { kind: 'cancelled', text: 'Export cancelled - no file was made.' };
    view.rerender?.(<PMExportProjectWindow visible projectGUID={P} ownerGUID="o" onClose={jest.fn()} />);
    await act(async () => { await Promise.resolve(); });
    expect(textOf('pm-export-project-status')).toContain('Export cancelled');
    expect(textOf('pm-export-project-percent')).toBe('0 %');
    expect(textOf('pm-export-project-export')).toContain('Try again');
    expect(textOf('pm-export-project-cancel')).toContain('Cancel');
    expect(textOf('pm-export-project-cancel')).not.toContain('Cancel export');
  });
});
