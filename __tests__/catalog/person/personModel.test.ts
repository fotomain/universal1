// Tests for personModel: table name, normalize, validate, auto title, card mapping.
import {
  PERSON_CATALOG_OWNER,
  PERSON_ENTITY,
  normalizePerson,
  personToCard,
  personsTable,
  validatePerson,
} from '../../../kit8/catalog/person/personModel';

describe('personModel', () => {
  it('table constants', () => {
    expect(personsTable).toBe('personTable');
    expect(PERSON_ENTITY).toBe('personReusable');
    expect(PERSON_CATALOG_OWNER).toBe('personCatalog');
  });

  it('normalize: auto-generates personTitle from first + last name when title is empty', () => {
    const normalized = normalizePerson({
      personFirstName: ' Alice ',
      personLastName: ' Wonder ',
      personTitle: '',
      personEmail: ' ALICE@EXAMPLE.COM ',
    });

    expect(normalized.personFirstName).toBe('Alice');
    expect(normalized.personLastName).toBe('Wonder');
    expect(normalized.personTitle).toBe('Alice Wonder');
    expect(normalized.personEmail).toBe('ALICE@EXAMPLE.COM');
    expect(normalized.isActive).toBe(true);
    expect(normalized.personIsEmployee).toBe(false);
  });

  it('normalize: preserves explicit custom personTitle', () => {
    const normalized = normalizePerson({
      personFirstName: 'Alice',
      personLastName: 'Wonder',
      personTitle: 'Dr. Alice W.',
    });

    expect(normalized.personTitle).toBe('Dr. Alice W.');
  });

  it('normalize: preserves employee data even when flag is false', () => {
    const normalized = normalizePerson({
      personFirstName: 'Bob',
      personIsEmployee: false,
      employeeData: {
        employeeNumber: 'EMP-99',
        bankIban: 'lv80haba0551000000000',
      },
    });

    expect(normalized.personIsEmployee).toBe(false);
    expect(normalized.employeeData?.employeeNumber).toBe('EMP-99');
    expect(normalized.employeeData?.bankIban).toBe('LV80HABA0551000000000');
  });

  it('validate: requires first name, validates email format and employee rules', () => {
    expect(validatePerson(normalizePerson({ personFirstName: '' })).personFirstName).toBeDefined();

    expect(validatePerson(normalizePerson({ personFirstName: 'Alice', personEmail: 'not-an-email' })).personEmail).toBeDefined();

    const validNonEmployee = normalizePerson({ personFirstName: 'Alice', personEmail: 'alice@example.com' });
    expect(validatePerson(validNonEmployee)).toEqual({});

    // When personIsEmployee = true, requires employeeNumber or personalCode
    const invalidEmployee = normalizePerson({
      personFirstName: 'Bob',
      personIsEmployee: true,
      employeeData: { position: 'Dev' },
    });
    expect(validatePerson(invalidEmployee).employeeNumber).toBeDefined();

    const validEmployee = normalizePerson({
      personFirstName: 'Bob',
      personIsEmployee: true,
      employeeData: { employeeNumber: 'EMP-123' },
    });
    expect(validatePerson(validEmployee)).toEqual({});
  });

  it('personToCard: formats title, description with employee badge, position, contact info', () => {
    const card = personToCard({
      rowGUID: 'p-1',
      orderInList: 10,
      rowJSON: {
        personFirstName: 'John',
        personLastName: 'Doe',
        personTitle: 'John Doe',
        personEmail: 'john@example.com',
        personPhone: '+1 555-1234',
        personIsEmployee: true,
        employeeData: { position: 'CTO' },
        isActive: false,
      },
    });

    expect(card.id).toBe('p-1');
    expect(card.title).toBe('John Doe');
    expect(card.description).toContain('Employee');
    expect(card.description).toContain('CTO');
    expect(card.description).toContain('john@example.com');
    expect(card.description).toContain('+1 555-1234');
    expect(card.description).toContain('inactive');
  });
});
