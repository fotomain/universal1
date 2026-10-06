/** @jest-environment jsdom */
// Gantt bar "Export" menu (PDF / JSON / MS Project), PMExportToMSProject window, the export buttons of the
// Project settings window and DateInputApp (calendar icon inside at the left, clear icon inside at the right).
import { act } from 'react';
import { cleanupUI, mustGet, press, q, renderUI, seedStore, textOf, typeInto, inputValue } from './pmUiTestKit';

const mockPdf = jest.fn(async () => 'downloaded');
jest.mock('../../../kit8/pm/crud/exchange/pdf/exportDashboardToPdf', () => ({
  exportProjectDashboardToPdf: (...a: any[]) => (mockPdf as any)(...a),
  exportDashboardToPdf: jest.fn(),
  registerDashboardPdfTarget: () => () => undefined,
  measureViewInWindow: async () => null,
}));
const mockDownload = jest.fn(async () => 'downloaded');
jest.mock('../../../kit8/pm/crud/exchange/project/export/downloadTextFile', () => ({ downloadTextFile: (...a: any[]) => (mockDownload as any)(...a) }));
const mockExchange = { exportProject: jest.fn(async () => null), importProject: jest.fn(), status: { kind: 'idle' }, busy: false };
jest.mock('../../../kit8/pm/crud/exchange/project/useProjectExchange', () => ({ useProjectExchange: () => mockExchange }));
jest.mock('../../../kit8/ui/components/common/ReceiveDraggableFilesComponent', () => ({ __esModule: true, default: () => null, ReceiveDraggableFilesComponent: () => null }));

import React from 'react';
import PMGanttExportButton from '../../../kit8/pm/view/gantt/buttons/PMGanttExportButton';
import PMExportToMSProject from '../../../kit8/pm/crud/exchange/msproject/PMExportToMSProject';
import ImportExportProject from '../../../kit8/pm/crud/exchange/project/ImportExportProject';
import DateInputApp from '../../../kit8/ui/components/common/date_input/DateInputApp';
import PMDateInput from '../../../kit8/pm/inner/inputs/PMDateInput';
import { defaultFormatDateInput, defaultParseDateInput } from '../../../kit8/ui/components/common/date_input/dateInputFormat';
import { makePMPalette } from '../../../kit8/pm/view/theme';
import { PM_DIALOG_BUTTON_WIDTH, PM_EXPORT_BUTTON_WIDTH } from '../../../kit8/pm/model/constants';

const palette = makePMPalette({ primary: '#6366f1', background: '#fff', surface: '#f8fafc', text: '#0f172a', border: '#cbd5e1', error: '#dc2626' }, false);
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

afterEach(() => {
  cleanupUI();
  jest.clearAllMocks();
});

describe('Gantt bar: Export menu', () => {
  it('Export opens the menu with PDF / JSON / MS Project in that order', () => {
    seedStore();
    renderUI(<PMGanttExportButton palette={palette} />);
    expect(textOf('pm-gantt-export')).toContain('Export');
    expect(q('pm-gantt-export-menu')).toBeNull();
    press('pm-gantt-export');
    const ids = Array.from(mustGet('pm-gantt-export-menu').querySelectorAll('[role="menuitem"]')).map((e) => e.getAttribute('data-testid'));
    expect(ids).toEqual(['pm-gantt-export-pdf', 'pm-gantt-export-json', 'pm-gantt-export-msproject']);
    expect(textOf('pm-gantt-export-pdf')).toContain('Export to PDF');
    expect(textOf('pm-gantt-export-json')).toContain('Export to JSON');
    expect(textOf('pm-gantt-export-msproject')).toContain('Export to MS Project');
    press('pm-gantt-export-menu-backdrop');
    expect(q('pm-gantt-export-menu')).toBeNull();
  });

  it('Export to PDF exports the selected project and closes the menu', async () => {
    const { demo } = seedStore();
    renderUI(<PMGanttExportButton palette={palette} />);
    press('pm-gantt-export');
    press('pm-gantt-export-pdf');
    await flush();
    expect(q('pm-gantt-export-menu')).toBeNull();
    expect(mockPdf).toHaveBeenCalledWith(demo.projects[0].rowGUID, expect.objectContaining({ delayMs: expect.any(Number) }));
  });

  it('Export to JSON downloads project_data_<rowGUID>.json built from the open project', async () => {
    const { demo } = seedStore();
    const P = demo.projects[0].rowGUID;
    renderUI(<PMGanttExportButton palette={palette} />);
    press('pm-gantt-export');
    press('pm-gantt-export-json');
    await flush();
    expect(mockDownload).toHaveBeenCalledTimes(1);
    const [fileName, text] = mockDownload.mock.calls[0] as any;
    expect(fileName).toBe(`project_data_${P}.json`);
    const file = JSON.parse(text);
    expect(file.format).toBe('kit8.pm.project');
    expect(file.project.rowGUID).toBe(P);
    expect(file.tasks.length).toBe(demo.tasks.filter((t: any) => t.projectGUID === P).length);
  });

  it('Export to MS Project opens PMExportToMSProject', () => {
    seedStore();
    renderUI(<PMGanttExportButton palette={palette} />);
    expect(q('pm-export-msproject-window')).toBeNull();
    press('pm-gantt-export');
    press('pm-gantt-export-msproject');
    expect(q('pm-gantt-export-menu')).toBeNull();
    expect(q('pm-export-msproject-window')).not.toBeNull();
    press('pm-export-msproject-cancel');
    expect(q('pm-export-msproject-window')).toBeNull();
  });
});

describe('PMExportToMSProject', () => {
  const checked = (id: string) => mustGet(id).getAttribute('aria-checked') === 'true';

  it('"Export custom fields" check boxes + Export -> exporter(project, choices), shows progress then success with Close button', async () => {
    const { demo } = seedStore();
    const P = demo.projects[0].rowGUID;
    let finishExport: () => void = () => {};
    const exporter = jest.fn(
      () =>
        new Promise<any>((resolve) => {
          finishExport = () => resolve({ fileName: 'x.xml', xml: '', tasks: 7, result: 'downloaded' as const });
        }),
    );
    const onClose = jest.fn();
    renderUI(<PMExportToMSProject visible projectGUID={P} onClose={onClose} exporter={exporter as any} />);
    expect(textOf('pm-export-msproject-window')).toContain('Export custom fields');
    expect(textOf('pm-export-msproject-kanban-stage')).toContain('Export Kanban Stage');
    expect(textOf('pm-export-msproject-kanban-percent')).toContain('Export Kanban Percent');
    expect(checked('pm-export-msproject-kanban-stage')).toBe(true);
    expect(checked('pm-export-msproject-kanban-percent')).toBe(true);
    press('pm-export-msproject-kanban-percent');
    expect(checked('pm-export-msproject-kanban-percent')).toBe(false);
    expect(textOf('pm-export-msproject-export')).toContain('Export');

    // Press Export -> shows export progress while busy
    press('pm-export-msproject-export');
    expect(q('pm-export-msproject-progress')).not.toBeNull();
    expect(textOf('pm-export-msproject-progress')).toContain('Export in progress…');

    // Finish export
    await act(async () => {
      finishExport();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(exporter).toHaveBeenCalledWith(P, { exportKanbanStage: true, exportKanbanPercent: false });
    // Shows "Export successfully finished" and detail
    expect(textOf('pm-export-msproject-status')).toContain('Export successfully finished');
    expect(textOf('pm-export-msproject-status')).toContain('x.xml');

    // Export button is gone, Close button is primary with paper primary color
    expect(q('pm-export-msproject-export')).toBeNull();
    expect(textOf('pm-export-msproject-cancel')).toContain('Close');
    const closeBtn = mustGet('pm-export-msproject-cancel');
    expect(closeBtn.style.backgroundColor).toMatch(/99,\s?102,\s?241|#6366f1/i);

    // Press Close button -> closes window
    press('pm-export-msproject-cancel');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('the real export downloads a Microsoft Project XML of the open project', async () => {
    const { demo } = seedStore();
    const P = demo.projects[0].rowGUID;
    renderUI(<PMExportToMSProject visible projectGUID={P} onClose={jest.fn()} />);
    press('pm-export-msproject-export');
    await flush();
    expect(mockDownload).toHaveBeenCalledTimes(1);
    const [fileName, xml, mime] = mockDownload.mock.calls[0] as any;
    expect(fileName).toMatch(/\.xml$/);
    expect(mime).toBe('application/xml');
    expect(xml).toContain('<Project xmlns="http://schemas.microsoft.com/project">');
    expect((xml.match(/<Task>/g) || []).length).toBe(demo.tasks.filter((t: any) => t.projectGUID === P).length);
    expect(xml).toContain('<PredecessorLink>');
  });

  it('shows the error of a failed export; Cancel and Export are equal in size', async () => {
    const { demo } = seedStore();
    const exporter = jest.fn(async () => {
      throw new Error('boom');
    });
    renderUI(<PMExportToMSProject visible projectGUID={demo.projects[0].rowGUID} onClose={jest.fn()} exporter={exporter as any} />);
    expect(mustGet('pm-export-msproject-cancel').style.width).toBe(`${PM_DIALOG_BUTTON_WIDTH}px`);
    expect(mustGet('pm-export-msproject-export').style.width).toBe(`${PM_DIALOG_BUTTON_WIDTH}px`);
    // Cancel is secondary (transparent), Export is primary (contained with primary color)
    expect(mustGet('pm-export-msproject-cancel').style.backgroundColor).toMatch(/transparent|rgba\(0, 0, 0, 0\)/);
    expect(mustGet('pm-export-msproject-export').style.backgroundColor).toMatch(/99,\s?102,\s?241|#6366f1/i);
    press('pm-export-msproject-export');
    await flush();
    expect(textOf('pm-export-msproject-status')).toContain('boom');
  });
});

describe('Project settings: export buttons', () => {
  const colors = { text: '#000', primary: '#6366f1', error: '#dc2626', border: '#ccc' };

  it('JSON / PDF / MS Project: equal size, outlined (transparent + primary border); Save as template on Export tab only', () => {
    const { demo } = seedStore();
    const P = demo.projects[0].rowGUID;
    const onExportPdf = jest.fn();
    const onSaveAsTemplate = jest.fn();
    renderUI(<ImportExportProject ownerGUID="o" projectGUID={P} colors={colors} onExportPdf={onExportPdf} onSaveAsTemplate={onSaveAsTemplate} />);
    // Not present on Import tab
    expect(q('pm-settings-save-as-template')).toBeNull();

    press('pm-project-exchange-tab-TabExport');
    const group = mustGet('pm-project-export-button-group');
    expect(getComputedStyle(group).gap || getComputedStyle(group).rowGap).toBe('2px');
    for (const id of ['pm-project-export', 'pm-project-export-pdf', 'pm-project-export-msproject', 'pm-settings-save-as-template']) {
      const st = mustGet(id).style;
      expect(st.width).toBe(`${PM_EXPORT_BUTTON_WIDTH}px`);
      expect(st.backgroundColor).toMatch(/transparent|rgba\(0, 0, 0, 0\)/);
      expect(st.borderTopColor || st.borderColor).toMatch(/99,\s?102,\s?241|#6366f1/i);
    }
    press('pm-project-export-pdf');
    expect(onExportPdf).toHaveBeenCalledWith(P);
    press('pm-settings-save-as-template');
    expect(onSaveAsTemplate).toHaveBeenCalledTimes(1);
    press('pm-project-export-msproject');
    expect(q('pm-export-msproject-window')).not.toBeNull();
  });

  it('PDF / MS Project are for the project that is open on the dashboard', () => {
    const { demo } = seedStore();
    renderUI(<ImportExportProject ownerGUID="o" projectGUID={demo.projects[1].rowGUID} colors={colors} onExportPdf={jest.fn()} />);
    press('pm-project-exchange-tab-TabExport');
    expect(mustGet('pm-project-export-pdf').getAttribute('aria-disabled')).toBe('true');
    expect(mustGet('pm-project-export-msproject').getAttribute('aria-disabled')).toBe('true');
    expect(mustGet('pm-project-export').getAttribute('aria-disabled')).not.toBe('true');
    expect(q('pm-project-export-dashboard-hint')).not.toBeNull();
  });
});

describe('DateInputApp', () => {
  it('parses / formats dates', () => {
    expect(defaultFormatDateInput(defaultParseDateInput('2026-10-06')!)).toBe('2026-10-06');
    expect(defaultFormatDateInput(defaultParseDateInput('6.10.2026')!)).toBe('2026-10-06');
    expect(defaultParseDateInput('2026-02-31')).toBeNull();
    expect(defaultParseDateInput('soon')).toBeNull();
  });

  it('calendar icon at the left of the text, clear icon at the right - both inside the input box', () => {
    const onChange = jest.fn();
    renderUI(<DateInputApp testID="d" value="2026-10-06" onChangeText={onChange} />);
    const input = mustGet('d');
    const cal = mustGet('d-datepicker-trigger');
    const clear = mustGet('d-clear');
    const box = input.parentElement!;
    expect(cal.parentElement).toBe(box);
    expect(clear.parentElement).toBe(box);
    expect(Array.from(box.children)).toEqual([cal, input, clear]);
    expect(inputValue('d')).toBe('2026-10-06');
    press('d-clear');
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('no clear icon when empty; typing works; the calendar writes the picked date', () => {
    const onChange = jest.fn();
    const onSelectDate = jest.fn();
    renderUI(<DateInputApp testID="d" value="" onChangeText={onChange} onSelectDate={onSelectDate} />);
    expect(q('d-clear')).toBeNull();
    typeInto('d', '2026-01-02');
    expect(onChange).toHaveBeenLastCalledWith('2026-01-02');
    expect(q('mock-date-picker-modal')).toBeNull();
    press('d-datepicker-trigger');
    expect(q('mock-date-picker-modal')).not.toBeNull();
    press('mock-date-picker-confirm'); // the mock picks 2026-09-30
    expect(onChange).toHaveBeenLastCalledWith('2026-09-30');
    expect(onSelectDate).toHaveBeenCalledWith(expect.any(Date));
    expect(q('mock-date-picker-modal')).toBeNull();
  });

  it('PMDateInput writes the picked day in the project date format', () => {
    const onChange = jest.fn();
    renderUI(<PMDateInput testID="p" dateFormat="DD.MM.YYYY" value="05.10.2026" onChangeText={onChange} />);
    press('p-datepicker-trigger');
    press('mock-date-picker-confirm'); // keeps the shown date
    expect(onChange).toHaveBeenLastCalledWith('05.10.2026');
  });
});
