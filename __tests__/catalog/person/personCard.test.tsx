/** @jest-environment jsdom */
import React, { act } from 'react';

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

jest.mock('../../../kit8/catalog/contract/ContractList', () => {
  const R = require('react');
  const { Text, View } = require('react-native');
  return ({ ownerGUID, partyType }: any) =>
    R.createElement(View, { testID: `mock-contract-list-${ownerGUID}` },
      R.createElement(Text, null, `Contracts for ${partyType} ${ownerGUID}`)
    );
});

import PersonCard from '../../../kit8/catalog/person/PersonCard';
import { personToCard } from '../../../kit8/catalog/person/personModel';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');

let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { (q(id) as any).click(); });

describe('PersonCard', () => {
  afterEach(() => {
    act(() => root?.unmount());
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  const personItem = {
    rowGUID: 'per-456',
    rowOwnerGUID: 'personCatalog',
    rowParentGUID: 'empty',
    orderInList: 0,
    rowJSON: {
      personFirstName: 'Alice',
      personLastName: 'Smith',
      personTitle: 'Alice Smith',
      personEmail: 'alice@example.com',
      isActive: true,
      personIsEmployee: true,
      employeeData: { position: 'Engineer', department: 'R&D' },
    },
  };

  it('renders title, employee badge, and position', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    root = createRoot(el);
    act(() => {
      root.render(<PersonCard card={personToCard(personItem, 0)} />);
    });

    expect(document.body.textContent).toContain('Alice Smith');
    expect(document.body.textContent).toContain('Employee');
    expect(document.body.textContent).toContain('Engineer');
    expect(document.body.textContent).toContain('alice@example.com');
  });

  it('has contracts icon button and calls onContracts when provided', () => {
    const onContracts = jest.fn();
    const onEdit = jest.fn();
    const onDelete = jest.fn();

    const el = document.createElement('div');
    document.body.appendChild(el);
    root = createRoot(el);
    act(() => {
      root.render(
        <PersonCard
          card={personToCard(personItem, 0)}
          onContracts={onContracts}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      );
    });

    expect(q('person-card-contracts-per-456')).not.toBeNull();
    press('person-card-contracts-per-456');
    expect(onContracts).toHaveBeenCalledWith('per-456');

    press('person-card-edit-per-456');
    expect(onEdit).toHaveBeenCalledWith('per-456');

    press('person-card-sql_for_delete-per-456');
    expect(onDelete).toHaveBeenCalledWith('per-456');
  });

  it('opens modal with ContractList when onContracts is not passed', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    root = createRoot(el);
    act(() => {
      root.render(<PersonCard card={personToCard(personItem, 0)} />);
    });

    expect(q('mock-contract-list-per-456')).toBeNull();
    press('person-card-contracts-per-456');
    expect(q('mock-contract-list-per-456')).not.toBeNull();
    expect(document.body.textContent).toContain('Alice Smith — Contracts');

    // Close modal
    press('person-contracts-close-per-456');
    expect(q('mock-contract-list-per-456')).toBeNull();
  });
});
