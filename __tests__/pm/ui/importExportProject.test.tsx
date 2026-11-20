/** @jest-environment jsdom */
// kit8/pm/crud/exchange/project/ImportExportProject (Project settings -> Import / Export) + the web download.
import { act } from 'react';
import { cleanupUI, expectInOrder, press, q, renderUI, seedStore, textOf } from './pmUiTestKit';

const mockExport = jest.fn(async () => null);
const mockImport = jest.fn(async () => ({ projectRowJSON: { rowKind: 'project', name: 'P', skipWeekends: true } }));
let mockStatus: any = { kind: 'idle' };
jest.mock('../../../kit8/pm/crud/exchange/project/useProjectExchange', () => ({
  useProjectExchange: () => ({ exportProject: mockExport, importProject: mockImport, status: mockStatus, busy: mockStatus.kind === 'busy' }),
}));
// the switches of the Export tab: a press toggles (the real switch is a native control)
jest.mock('../../../kit8/ui/components/common/SwitchApp', () => ({
  __esModule: true,
  default: (p: any) => require('react').createElement(require('react-native').Pressable, { testID: p.testID, onPress: () => !p.disabled && p.onValueChange(!p.value) }, null),
}));
// the drop zone: a button that "drops" a file (drag & drop itself is the browser's job)
const mockDropProps = jest.fn();
jest.mock('../../../kit8/ui/components/common/ReceiveDraggableFilesComponent', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  const C = (props: any) => {
    mockDropProps(props);
    return R.createElement(
      Pressable,
      { testID: props.testID, onPress: () => props.onFilesDropped([{ name: 'project_data_x.json', mimeType: 'application/json' }]) },
      R.createElement(Text, null, props.title)
    );
  };
  return { __esModule: true, default: C, ReceiveDraggableFilesComponent: C };
});

import React from 'react';
import ImportExportProject from '../../../kit8/pm/crud/exchange/project/ImportExportProject';
import { PM_EXPORT_BUTTON_WIDTH } from '../../../kit8/pm/model/constants';
import { downloadTextFile } from '../../../kit8/pm/crud/exchange/project/export/downloadTextFile';

afterEach(() => {
  cleanupUI();
  jest.clearAllMocks();
  mockStatus = { kind: 'idle' };
});
const colors = { text: '#000', primary: '#6366f1', error: '#dc2626', border: '#ccc' };

describe('ImportExportProject', () => {
  const selected = (tab: string) => q(`pm-project-exchange-tab-${tab}`)!.getAttribute('aria-selected') === 'true';

  it('top tabs Import (default) · Export; each shows only its part', () => {
    const { demo } = seedStore();
    renderUI(<ImportExportProject ownerGUID="o" projectGUID={demo.projects[0].rowGUID} colors={colors} />);
    expectInOrder(['pm-project-exchange-tab-TabImport', 'pm-project-exchange-tab-TabExport']);
    expect(selected('TabImport')).toBe(true);
    expect(q('pm-project-import-drop')).not.toBeNull();
    expect(q('pm-project-export')).toBeNull();
    press('pm-project-exchange-tab-TabExport');
    expect(selected('TabExport')).toBe(true);
    expect(q('pm-project-export')).not.toBeNull();
    expect(q('pm-project-import-drop')).toBeNull();
    press('pm-project-exchange-tab-TabImport');
    expect(q('pm-project-import-drop')).not.toBeNull();
  });

  it('the project GUID stands above Import / Export with a button that copies it to the clipboard', async () => {
    const { demo } = seedStore();
    const P = demo.projects[0].rowGUID;
    renderUI(<ImportExportProject ownerGUID="o" projectGUID={P} colors={colors} />);
    expect(textOf('pm-project-guid')).toBe(P);
    expectInOrder(['pm-project-guid-row', 'pm-project-exchange-tab-TabImport']);
    expect(textOf('pm-project-exchange').indexOf(P)).toBeLessThan(textOf('pm-project-exchange').indexOf('Import / Export'));
    press('pm-project-guid-copy');
    await act(async () => { await Promise.resolve(); });
    expect(require('expo-clipboard').setStringAsync).toHaveBeenCalledWith(P); // (mocked by pmUiTestKit)
    expect(textOf('pm-project-guid-copy')).toBe('Copied');
  });

  it('Export -> exportProject(project); shows project_data_<rowGUID>.json', () => {
    const { demo } = seedStore();
    const P = demo.projects[0].rowGUID;
    renderUI(<ImportExportProject ownerGUID="o" projectGUID={P} colors={colors} />);
    expect(q('pm-project-exchange')).not.toBeNull();
    press('pm-project-exchange-tab-TabExport');
    press('pm-project-export');
    expect(mockExport).toHaveBeenCalledWith(P, { taskLines: true, bim: false, bimProperties: false });
    expect(textOf('pm-project-exchange')).toContain(`project_data_${P}.json`);
    // centered: button, description and file name
    expect(getComputedStyle(q('pm-project-export-panel')!).alignItems).toBe('center');
    expect(getComputedStyle(q('pm-project-export-file-name')!).textAlign).toBe('center');
  });

  it('Export tab: task lines switch (on); BIM switches only on a BIM project; the zip button + file name follow the BIM switch', () => {
    const { demo } = seedStore();
    const P = demo.projects[0].rowGUID;
    renderUI(<ImportExportProject ownerGUID="o" projectGUID={P} colors={colors} />);
    press('pm-project-exchange-tab-TabExport');
    expect(q('pm-project-export-opt-lines')).not.toBeNull();
    expect(q('pm-project-export-opt-bim')).toBeNull();                       // a plain project has no model to export
    expect(textOf('pm-project-export')).toContain('Export to JSON');
    press('pm-project-export-opt-lines');                                    // task lines off
    press('pm-project-export');
    expect(mockExport).toHaveBeenLastCalledWith(P, { taskLines: false, bim: false, bimProperties: false });
  });

  it('a BIM project: package export (zip) by default, properties are an option, switching the model off gives the JSON again', () => {
    const { demo } = seedStore();
    const P = demo.projects[0].rowGUID;
    const { usePMStore } = require('../../../kit8/pm/store/store_pm');
    usePMStore.setState((s: any) => ({ projectsById: { ...s.projectsById, [P]: { ...s.projectsById[P], rowJSON: { ...s.projectsById[P].rowJSON, projectIsBIMBased: true } } } }));
    renderUI(<ImportExportProject ownerGUID="o" projectGUID={P} colors={colors} />);
    press('pm-project-exchange-tab-TabExport');
    expect(q('pm-project-export-opt-bim')).not.toBeNull();
    expect(textOf('pm-project-export')).toContain('Export package (zip)');
    expect(textOf('pm-project-export-file-name')).toBe(`project_package_${P}.zip`);
    expect(q('pm-project-export-opt-bim-props')).not.toBeNull();
    // BIM properties are ON by default (owner 2026-11-20): the first export carries them, the switch turns them off
    press('pm-project-export');
    expect(mockExport).toHaveBeenLastCalledWith(P, { taskLines: true, bim: true, bimProperties: true });
    press('pm-project-export-opt-bim-props');
    press('pm-project-export');
    expect(mockExport).toHaveBeenLastCalledWith(P, { taskLines: true, bim: true, bimProperties: false });
    press('pm-project-export-opt-bim');
    expect(q('pm-project-export-opt-bim-props')).toBeNull();                 // no properties without the model
    expect(textOf('pm-project-export')).toContain('Export to JSON');
    expect(textOf('pm-project-export-file-name')).toBe(`project_data_${P}.json`);
  });

  it('import drop zone: compact + "Choose file…" for .json; a drop imports into THIS project and reports back', async () => {
    const { demo } = seedStore();
    const P = demo.projects[0].rowGUID;
    const onImported = jest.fn();
    renderUI(<ImportExportProject ownerGUID="o" projectGUID={P} colors={colors} onImported={onImported} />);
    expect(mockDropProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        compact: true,
        pickable: true,
        pickButtonWidth: PM_EXPORT_BUTTON_WIDTH,
        accept: '.json,.zip,application/json,application/zip',
        testID: 'pm-project-import-drop',
      })
    );
    expect(mockDropProps.mock.calls[mockDropProps.mock.calls.length - 1][0].style).toMatchObject({ flexGrow: 1 }); // full height of the window
    await act(async () => {
      press('pm-project-import-drop');
      await Promise.resolve();
    });
    expect(mockImport).toHaveBeenCalledWith(P, [{ name: 'project_data_x.json', mimeType: 'application/json' }]);
    expect(onImported).toHaveBeenCalledWith({ rowKind: 'project', name: 'P', skipWeekends: true });
  });

  it('status line; busy disables export and the drop zone', () => {
    const { demo } = seedStore();
    mockStatus = { kind: 'busy', text: 'Importing…' };
    renderUI(<ImportExportProject ownerGUID="o" projectGUID={demo.projects[0].rowGUID} colors={colors} />);
    expect(textOf('pm-project-exchange-status')).toBe('Importing…');
    expect(mockDropProps).toHaveBeenLastCalledWith(expect.objectContaining({ disabled: true }));
    press('pm-project-exchange-tab-TabExport');
    expect(textOf('pm-project-exchange-status')).toBe('Importing…'); // the status stays under both tabs
    press('pm-project-export');
    expect(mockExport).not.toHaveBeenCalled();
  });
});

describe('downloadTextFile (web): automatic download', () => {
  it('creates a Blob URL, clicks an <a download="project_data_….json">, releases the URL', async () => {
    // jsdom + expo's lazy URL polyfill need TextEncoder (test environment only)
    const { TextEncoder, TextDecoder } = require('util');
    Object.assign(globalThis, { TextEncoder, TextDecoder });
    jest.useFakeTimers();
    const created: any[] = [];
    (URL as any).createObjectURL = jest.fn((b: Blob) => {
      created.push(b);
      return 'blob:x';
    });
    (URL as any).revokeObjectURL = jest.fn();
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('project_data_abc.json');
      expect(this.getAttribute('href')).toBe('blob:x');
    });
    await expect(downloadTextFile('project_data_abc.json', '{"a":1}')).resolves.toBe('downloaded');
    expect(click).toHaveBeenCalledTimes(1);
    expect(created[0].type).toMatch(/application\/json/);
    expect(document.querySelector('a[download]')).toBeNull(); // removed again
    jest.advanceTimersByTime(1500);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
    click.mockRestore();
    jest.useRealTimers();
  });
});
