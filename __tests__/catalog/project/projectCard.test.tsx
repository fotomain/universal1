/** @jest-environment jsdom */
import React, { act } from 'react';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({
    activeSystem: 'native',
    isDark: false,
    themeColors: {
      primary: '#6366f1',
      background: '#fff',
      surface: '#fff',
      text: '#000',
      border: '#ccc',
      error: '#d00',
    },
  }),
}));

jest.mock('../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return ({ testID, name, onPress }: any) =>
    R.createElement(Pressable, { testID, onPress }, R.createElement(Text, null, name));
});

import ProjectCard, { isCompactProjectCard, PROJECT_CARD_COMPACT_WIDTH } from '../../../kit8/catalog/project/ProjectCard';
import { ProjectCardActionsContext } from '../../../kit8/catalog/project/copy/ProjectCardActionsContext';
import { projectToCard } from '../../../kit8/catalog/project/projectCatalogModel';
import { usePMStore } from '../../../kit8/pm/store/store_pm';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');

let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { (q(id) as any).click(); });

describe('ProjectCard', () => {
  beforeEach(() => {
    usePMStore.setState({
      selectedProjectGUID: null,
      recentProjectGUIDs: [],
      projectsById: {},
    });
    mockPush.mockClear();
  });

  afterEach(() => {
    act(() => root?.unmount());
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  const sampleProject = {
    rowGUID: 'proj-999',
    treePath: 'proj_999',
    rowOwnerGUID: 'user-1',
    rowDuration: new Date('2026-10-15T00:00:00Z').toISOString(),
    rowProgress: 65,
    orderInList: 0,
    rowJSON: {
      rowKind: 'project' as const,
      name: 'Timber Construction 2026',
      durationDays: 15,
      projectStartAt: new Date('2026-10-01T00:00:00Z').toISOString(),
      skipWeekends: true,
    },
  };

  it('renders project name, progress, dates and Dashboard button', () => {
    const card = projectToCard(sampleProject);
    const div = document.createElement('div');
    document.body.appendChild(div);
    root = createRoot(div);
    act(() => {
      root.render(<ProjectCard card={card} />);
    });

    expect(document.body.textContent).toContain('Timber Construction 2026');
    expect(document.body.textContent).toContain('65%');
    expect(q('project-dashboard-proj-999')).not.toBeNull();
  });

  it('pressing Dashboard button selects project and navigates to /pm/project/dashboard', () => {
    const card = projectToCard(sampleProject);
    const div = document.createElement('div');
    document.body.appendChild(div);
    root = createRoot(div);
    act(() => {
      root.render(<ProjectCard card={card} />);
    });

    press('project-dashboard-proj-999');

    // Verify it navigated to PM project dashboard
    expect(mockPush).toHaveBeenCalledWith('/pm/project/dashboard');
    // Verify it selected project in PM store
    expect(usePMStore.getState().selectedProjectGUID).toBe('proj-999');
    expect(usePMStore.getState().recentProjectGUIDs).toContain('proj-999');
  });

  it('pressing the card triggers onSelect and selects project for Gantt preview', () => {
    const onSelect = jest.fn();
    const card = projectToCard(sampleProject);
    const div = document.createElement('div');
    document.body.appendChild(div);
    root = createRoot(div);
    act(() => {
      root.render(<ProjectCard card={card} onSelect={onSelect} />);
    });

    press('project-card-main-proj-999');

    expect(onSelect).toHaveBeenCalledWith('proj-999');
    expect(usePMStore.getState().selectedProjectGUID).toBe('proj-999');
  });

  describe('card menu (right click + three dots)', () => {
    const mount = (el: React.ReactElement) => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      root = createRoot(div);
      act(() => root.render(el));
    };
    const withActions = (card: any, props: any = {}, actions: any = { onCopy: jest.fn(), onCopyWithTasks: jest.fn() }) => (
      <ProjectCardActionsContext.Provider value={actions}>
        <ProjectCard card={card} {...props} />
      </ProjectCardActionsContext.Provider>
    );

    it('has a three dots button that opens Copy / Copy with Tasks / Delete', () => {
      mount(withActions(projectToCard(sampleProject), { onDelete: jest.fn() }));
      expect(q('project-menu-popup-proj-999')).toBeNull();
      press('project-menu-proj-999');
      expect(q('project-menu-popup-proj-999')).not.toBeNull();
      expect(q('project-menu-copy-proj-999')).not.toBeNull();
      expect(q('project-menu-copy-tasks-proj-999')).not.toBeNull();
      expect(q('project-menu-delete-proj-999')).not.toBeNull();
      expect(document.body.textContent).toContain('Copy with Tasks');
    });

    it('a right click on the card opens the same menu', () => {
      mount(withActions(projectToCard(sampleProject), { onDelete: jest.fn() }));
      const card = q('project-card-proj-999') as HTMLElement;
      const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 60 });
      act(() => {
        card.dispatchEvent(ev);
      });
      expect(ev.defaultPrevented).toBe(true);
      expect(q('project-menu-copy-proj-999')).not.toBeNull();
    });

    it('Copy and Copy with Tasks call their handler with the project id and close the menu', () => {
      const actions = { onCopy: jest.fn(), onCopyWithTasks: jest.fn() };
      mount(withActions(projectToCard(sampleProject), {}, actions));
      press('project-menu-proj-999');
      press('project-menu-copy-proj-999');
      expect(actions.onCopy).toHaveBeenCalledWith('proj-999');
      expect(actions.onCopyWithTasks).not.toHaveBeenCalled();
      expect(q('project-menu-popup-proj-999')).toBeNull();
      press('project-menu-proj-999');
      press('project-menu-copy-tasks-proj-999');
      expect(actions.onCopyWithTasks).toHaveBeenCalledWith('proj-999');
    });

    it('Copy with BIM is offered only for a BIM project and calls onCopyWithBim', () => {
      const actions = { onCopy: jest.fn(), onCopyWithTasks: jest.fn(), onCopyWithBim: jest.fn() };
      mount(withActions(projectToCard(sampleProject), {}, actions));
      press('project-menu-proj-999');
      expect(q('project-menu-copy-bim-proj-999')).toBeNull();
      act(() => root.unmount());
      document.body.innerHTML = '';
      const bimProject = { ...sampleProject, rowJSON: { ...(sampleProject as any).rowJSON, projectIsBIMBased: true } };
      mount(withActions(projectToCard(bimProject as any), {}, actions));
      press('project-menu-proj-999');
      expect(q('project-menu-copy-bim-proj-999')).not.toBeNull();
      expect(document.body.textContent).toContain('Copy with BIM');
      press('project-menu-copy-bim-proj-999');
      expect(actions.onCopyWithBim).toHaveBeenCalledWith('proj-999');
      expect(actions.onCopyWithTasks).not.toHaveBeenCalled();
    });

    it('Delete of the menu calls onDelete', () => {
      const onDelete = jest.fn();
      mount(withActions(projectToCard(sampleProject), { onDelete }));
      press('project-menu-proj-999');
      press('project-menu-delete-proj-999');
      expect(onDelete).toHaveBeenCalledWith('proj-999');
    });

    it('without actions and without onDelete there is no menu', () => {
      mount(<ProjectCard card={projectToCard(sampleProject)} />);
      expect(q('project-menu-proj-999')).toBeNull();
    });
  });

  it('a narrow card is compact (buttons on their own row, the title keeps the first row); a wide or unmeasured one is not', () => {
    expect(isCompactProjectCard(380)).toBe(true);
    expect(isCompactProjectCard(PROJECT_CARD_COMPACT_WIDTH - 1)).toBe(true);
    expect(isCompactProjectCard(PROJECT_CARD_COMPACT_WIDTH)).toBe(false);
    expect(isCompactProjectCard(null)).toBe(false);
  });

  it('still shows the full title and every button (compact decision only moves them)', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    root = createRoot(div);
    act(() => root.render(<ProjectCard card={projectToCard(sampleProject)} onEdit={jest.fn()} onDelete={jest.fn()} />));
    expect(document.body.textContent).toContain('Timber Construction 2026');
    for (const id of ['project-dashboard-proj-999', 'project-edit-proj-999', 'project-delete-proj-999', 'project-menu-proj-999']) expect(q(id)).not.toBeNull();
  });
});
