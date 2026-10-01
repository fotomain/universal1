import {
  canEditOrganization,
  emptyOrganization,
  normalizeOrganization,
  organizationToCard,
  validateOrganization,
} from '../../../kit8/catalog/organization/organizationModel';

describe('organizationModel', () => {
  it('emptyOrganization initializes default values with creator email', () => {
    const org = emptyOrganization('user@universal1.io');
    expect(org.organizationTitle).toBe('');
    expect(org.createdByUser).toBe('user@universal1.io');
    expect(org.contactEmail).toBe('user@universal1.io');
    expect(org.isActive).toBe(true);
    expect(org.legalData?.country).toBe('LV');
  });

  it('normalizeOrganization trims strings and formats VAT/IBAN', () => {
    const raw = {
      organizationTitle: '  Baltic Timber SIA  ',
      organizationLegalName: '  Baltic Timber SIA  ',
      createdByUser: '  Boss@Company.COM  ',
      legalData: {
        registrationNo: ' 40003123456 ',
        vatNo: ' lv40003123456 ',
        bankIban: ' lv80 haba 0551 0000 0000 1 ',
        country: ' lv ',
      },
    };
    const normalized = normalizeOrganization(raw);
    expect(normalized.organizationTitle).toBe('Baltic Timber SIA');
    expect(normalized.createdByUser).toBe('boss@company.com');
    expect(normalized.legalData?.registrationNo).toBe('40003123456');
    expect(normalized.legalData?.vatNo).toBe('LV40003123456');
    expect(normalized.legalData?.bankIban).toBe('LV80HABA0551000000001');
    expect(normalized.legalData?.country).toBe('LV');
  });

  it('validateOrganization requires title and creator email', () => {
    const invalid = validateOrganization({ organizationTitle: '', createdByUser: '' });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.organizationTitle).toBeDefined();
    expect(invalid.errors.createdByUser).toBeDefined();

    const valid = validateOrganization({
      organizationTitle: 'Nordic Timber',
      createdByUser: 'admin@nordic.com',
    });
    expect(valid.valid).toBe(true);
  });

  it('canEditOrganization only allows createdByUser to edit', () => {
    const org = {
      rowGUID: 'org-1',
      rowOwnerGUID: 'organizationCatalog',
      rowParentGUID: 'empty',
      orderInList: 0,
      rowJSON: {
        organizationTitle: 'My Org',
        createdByUser: 'owner@universal1.io',
        isActive: true,
      },
    };

    expect(canEditOrganization(org, 'owner@universal1.io')).toBe(true);
    expect(canEditOrganization(org, 'OWNER@UNIVERSAL1.IO')).toBe(true);
    expect(canEditOrganization(org, 'stranger@universal1.io')).toBe(false);
    expect(canEditOrganization(org, null)).toBe(false);
  });

  it('organizationToCard maps organization to CardItem', () => {
    const org = {
      rowGUID: 'org-123',
      rowOwnerGUID: 'organizationCatalog',
      rowParentGUID: 'empty',
      orderInList: 10,
      rowJSON: {
        organizationTitle: 'Timber Group',
        organizationLegalName: 'Timber Group AS',
        createdByUser: 'admin@timber.com',
        isActive: true,
      },
    };
    const card = organizationToCard(org, 0);
    expect(card.id).toBe('org-123');
    expect(card.title).toBe('Timber Group');
    expect(card.description).toContain('Timber Group AS');
    expect(card.description).toContain('admin@timber.com');
  });
});
