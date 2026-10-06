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

import PartnerCard from '../../../kit8/catalog/partner/PartnerCard';
import { partnerToCard } from '../../../kit8/catalog/partner/partnerModel';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');

let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { (q(id) as any).click(); });

describe('PartnerCard', () => {
  afterEach(() => {
    act(() => root?.unmount());
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  const partnerItem = {
    rowGUID: 'part-123',
    rowOwnerGUID: 'partnerCatalog',
    rowParentGUID: 'empty',
    orderInList: 0,
    rowJSON: {
      partnerTitle: 'Acme Logistics',
      partnerLegalName: 'Acme Logistics SIA',
      partnerKind: 'company' as const,
      isActive: true,
      partnerIsSupplier: true,
      partnerIsCustomer: true,
      legalData: { vatNo: 'LV40003000111', registrationNo: '40003000111', country: 'LV' },
    },
  };

  it('renders title, supplier and customer badges', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    root = createRoot(el);
    act(() => {
      root.render(<PartnerCard card={partnerToCard(partnerItem, 0)} />);
    });

    expect(document.body.textContent).toContain('Acme Logistics');
    expect(document.body.textContent).toContain('Supplier');
    expect(document.body.textContent).toContain('Customer');
    expect(document.body.textContent).toContain('VAT LV40003000111');
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
        <PartnerCard
          card={partnerToCard(partnerItem, 0)}
          onContracts={onContracts}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      );
    });

    expect(q('partner-card-contracts-part-123')).not.toBeNull();
    press('partner-card-contracts-part-123');
    expect(onContracts).toHaveBeenCalledWith('part-123');

    press('partner-card-edit-part-123');
    expect(onEdit).toHaveBeenCalledWith('part-123');

    press('partner-card-delete-part-123');
    expect(onDelete).toHaveBeenCalledWith('part-123');
  });

  it('opens modal with ContractList when onContracts is not passed', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    root = createRoot(el);
    act(() => {
      root.render(<PartnerCard card={partnerToCard(partnerItem, 0)} />);
    });

    expect(q('mock-contract-list-part-123')).toBeNull();
    press('partner-card-contracts-part-123');
    expect(q('mock-contract-list-part-123')).not.toBeNull();
    expect(document.body.textContent).toContain('Acme Logistics — Contracts');

    // Close modal
    press('partner-contracts-close-part-123');
    expect(q('mock-contract-list-part-123')).toBeNull();
  });
});
