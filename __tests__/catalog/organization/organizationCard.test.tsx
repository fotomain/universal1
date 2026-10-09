/** @jest-environment jsdom */
import React, { act } from 'react';

let mockReduxState: any = {};
jest.mock('react-redux', () => ({
  useSelector: (fn: any) => fn(mockReduxState),
  useDispatch: () => jest.fn(),
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

import OrganizationCard from '../../../kit8/catalog/organization/OrganizationCard';
import { organizationToCard } from '../../../kit8/catalog/organization/organizationModel';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');

let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { (q(id) as any).click(); });

describe('OrganizationCard', () => {
  afterEach(() => {
    act(() => root?.unmount());
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  const orgItem = {
    rowGUID: 'org-456',
    rowOwnerGUID: 'organizationCatalog',
    rowParentGUID: 'empty',
    orderInList: 0,
    rowJSON: {
      organizationTitle: 'Timber Holding SIA',
      organizationLegalName: 'Timber Holding SIA',
      createdByUser: 'creator@universal1.io',
      isActive: true,
      contactEmail: 'info@timberholding.com',
      legalData: { country: 'LV' },
    },
  };

  it('renders creator organization as editable with sql_for_delete button for the creator', () => {
    mockReduxState = {
      activeUserState: { activeUserEmail: 'creator@universal1.io', isLoggedIn: true },
    };

    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const card = organizationToCard(orgItem);

    const div = document.createElement('div');
    document.body.appendChild(div);
    root = createRoot(div);
    act(() => {
      root.render(<OrganizationCard card={card} onEdit={onEdit} onDelete={onDelete} />);
    });

    expect(document.body.textContent).toContain('Timber Holding SIA');
    expect(document.body.textContent).toContain('Your Organization');
    expect(q('organization-edit-org-456')).not.toBeNull();
    expect(q('organization-sql_for_delete-org-456')).not.toBeNull();

    press('organization-edit-org-456');
    expect(onEdit).toHaveBeenCalledWith('org-456');

    press('organization-sql_for_delete-org-456');
    expect(onDelete).toHaveBeenCalledWith('org-456');
  });

  it('renders as read-only with no sql_for_delete button for other users', () => {
    mockReduxState = {
      activeUserState: { activeUserEmail: 'stranger@universal1.io', isLoggedIn: true },
    };

    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const card = organizationToCard(orgItem);

    const div = document.createElement('div');
    document.body.appendChild(div);
    root = createRoot(div);
    act(() => {
      root.render(<OrganizationCard card={card} onEdit={onEdit} onDelete={onDelete} />);
    });

    expect(document.body.textContent).toContain('Timber Holding SIA');
    expect(document.body.textContent).toContain('Read-Only');
    expect(q('organization-edit-org-456')).not.toBeNull();
    // Delete button must NOT be rendered for non-creators
    expect(q('organization-sql_for_delete-org-456')).toBeNull();
  });
});
