/** @jest-environment jsdom */
// ProjectCardForList: the card of a project in the Projects ReusableList. It draws NO three dots / delete / copy of its own (the list gives them).
import React, { act } from 'react';

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name, testID }: any) => R.createElement(Text, { testID }, name) };
});

import ProjectCardForList, { PROJECT_CARD_INSET, PROJECT_CARD_ITEM_HEIGHT, projectDateRange } from '../../../kit8/catalog/project/ProjectCardForList';
import { usePMStore } from '../../../kit8/pm/store/store_pm';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });

const row = (over: any = {}) => ({ rowGUID: 'p1', rowOwnerGUID: 'u', rowParentGUID: 'org', orderInList: 1, rowProgress: 42.4, rowDuration: '2026-11-20T00:00:00Z', rowJSON: { name: 'Web Site', projectStartAt: '2026-10-13T00:00:00Z' }, ...over });
const state = (over: any = {}) => ({
  index: 0, reorderable: true, dragging: false, grip: <span data-testid="grip">grip</span>, canEdit: true, canAdd: true, canDelete: true, canOpen: false, archived: false,
  actions: { markUsed: jest.fn(), remove: jest.fn(), archive: jest.fn() } as any, ...over,
});
function mount(node: React.ReactElement) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(node));
}
beforeEach(() => { usePMStore.setState({ selectedProjectGUID: null } as any); });
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; });

describe('ProjectCardForList', () => {
  it('shows the name, the progress badge, the date range, the grip and the Dashboard + gear buttons; nothing the list already has (no menu, no delete)', () => {
    mount(<ProjectCardForList row={row()} state={state()} onDashboard={jest.fn()} onSettings={jest.fn()} />);
    expect(document.body.textContent).toContain('Web Site');
    expect(document.body.textContent).toContain('42%');
    expect(q('grip')).not.toBeNull();
    expect(q('project-dashboard-p1')).not.toBeNull();
    expect(q('project-edit-p1')).not.toBeNull();
    expect(q('project-delete-p1')).toBeNull();
    expect(q('project-menu-p1')).toBeNull();
    expect(document.body.textContent).not.toContain('Viewing');
  });

  it('a press on the card selects the project and marks the card as used; Dashboard and the gear call their handler', () => {
    const onSelect = jest.fn(); const onDashboard = jest.fn(); const onSettings = jest.fn(); const st = state();
    mount(<ProjectCardForList row={row()} state={st} onSelect={onSelect} onDashboard={onDashboard} onSettings={onSettings} />);
    press('project-card-main-p1');
    expect(onSelect).toHaveBeenCalledWith('p1');
    press('project-dashboard-p1');
    press('project-edit-p1');
    expect(onDashboard).toHaveBeenCalledWith('p1');
    expect(onSettings).toHaveBeenCalledWith('p1');
    expect(st.actions.markUsed).toHaveBeenCalledTimes(3);
  });

  it('the project shown in the Gantt preview has the Viewing badge', () => {
    usePMStore.setState({ selectedProjectGUID: 'p1' } as any);
    mount(<ProjectCardForList row={row()} state={state()} />);
    expect(document.body.textContent).toContain('Viewing');
  });

  it('a button that has no handler is not drawn', () => {
    mount(<ProjectCardForList row={row()} state={state()} />);
    expect(q('project-dashboard-p1')).toBeNull();
    expect(q('project-edit-p1')).toBeNull();
  });

  it('an archived project is dimmed (the list draws its Archive mark)', () => {
    mount(<ProjectCardForList row={row()} state={state({ archived: true })} />);
    const card = q('project-card-p1')!;
    const dimmed = Array.from(card.querySelectorAll('div')).some((d) => (d as HTMLElement).style.opacity === '0.6');
    expect(dimmed).toBe(true);
  });

  it('has the fixed item height of the list and the inset the swipe buttons follow', () => {
    expect(PROJECT_CARD_ITEM_HEIGHT).toBe(120);
    expect(PROJECT_CARD_INSET).toEqual({ x: 8, y: 4, radius: 12 });
    mount(<ProjectCardForList row={row()} state={state()} />);
    expect((q('project-card-p1') as HTMLElement).style.height).toBe('120px');
  });

  it('projectDateRange: both dates, only the start, or "Dates not set"', () => {
    expect(projectDateRange(row())).toMatch(/–/);
    expect(projectDateRange(row({ rowDuration: null }))).not.toMatch(/–/);
    expect(projectDateRange(row({ rowDuration: null, rowJSON: {} }))).toBe('Dates not set');
  });
});
