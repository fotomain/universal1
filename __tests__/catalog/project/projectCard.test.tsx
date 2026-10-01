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

jest.mock('../../../kit8/components/common/IconApp', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return ({ testID, name, onPress }: any) =>
    R.createElement(Pressable, { testID, onPress }, R.createElement(Text, null, name));
});

import ProjectCard from '../../../kit8/catalog/project/ProjectCard';
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
});
