// Person catalog - table + row shape + validation (pure, unit-tested).
//   SQL: public."personTable" (kit8/sql/init/create_person_table.sql), defTable.md pattern
//   rowGUID · rowOwnerGUID = PERSON_CATALOG_OWNER · rowParentGUID = 'empty' ·
//   orderInList · rowJSON = PersonRowJSON · created_at / updated_at

/** Supabase table name (SQL: personTable). */
export const personsTable = 'personTable';
/** SystemMetaData / redux entity key (reusableCrudSlice + reusableRootSaga). */
export const PERSON_ENTITY = 'personReusable';
/** rowOwnerGUID of every catalog row: shared catalog (or tenant GUID). */
export const PERSON_CATALOG_OWNER = 'personCatalog';

export const PERSON_ROUTES = { list: '/catalog/person/list', edit: '/catalog/person/edit' } as const;

/** readData payload of the catalog. */
export const PERSON_READ_PARAMS = { paginationSize: 1000, originationCurrentPage: 0 };

export interface EmployeeData {
  employeeNumber?: string;
  position?: string;
  department?: string;
  personalCode?: string;
  bankIban?: string;
}

export interface PersonRowJSON {
  personFirstName: string;
  personLastName?: string;
  /** UI display title; auto-computed as "First Last" unless explicitly entered */
  personTitle: string;
  personEmail?: string;
  personPhone?: string;
  isActive: boolean;
  /** Independent boolean flag (kept in step with personType by the Persons dashboard: Employee = true) */
  personIsEmployee: boolean;
  /** personTypeTable.rowGUID (Employee | Contractor ...): decides the descriptor sets of the person (kit8/catalog/person/personTypeModel.ts) */
  personType?: string | null;
  /** Legal/employee data: preserved even if personIsEmployee is toggled off */
  employeeData?: EmployeeData;
}

export interface PersonRow {
  rowGUID: string;
  rowOwnerGUID: string;
  rowParentGUID: string;
  orderInList: number;
  rowJSON: PersonRowJSON;
  created_at?: string;
  updated_at?: string;
}

export const personExample: PersonRowJSON = {
  personFirstName: 'John',
  personLastName: 'Doe',
  personTitle: 'John Doe',
  personEmail: 'john.doe@example.com',
  personPhone: '+1 555-0199',
  isActive: true,
  personIsEmployee: true,
  employeeData: {
    employeeNumber: 'EMP-001',
    position: 'Lead Engineer',
    department: 'Engineering',
    personalCode: '123456-78901',
    bankIban: 'GB82WEST12345698765432',
  },
};

export const emptyPerson = (): PersonRowJSON => ({
  personFirstName: '',
  personLastName: '',
  personTitle: '',
  personEmail: '',
  personPhone: '',
  isActive: true,
  personIsEmployee: false,
  personType: null,
  employeeData: {
    employeeNumber: '',
    position: '',
    department: '',
    personalCode: '',
    bankIban: '',
  },
});

/** Form values -> stored shape (trimmed strings, auto personTitle if blank). */
export function normalizePerson(v: Partial<PersonRowJSON>): PersonRowJSON {
  const firstName = String(v.personFirstName ?? '').trim();
  const lastName = String(v.personLastName ?? '').trim();
  const customTitle = String(v.personTitle ?? '').trim();

  // Auto-fill personTitle as "First Last" if not explicitly customized
  const autoTitle = [firstName, lastName].filter(Boolean).join(' ');
  const personTitle = customTitle || autoTitle;

  const rawEmp = v.employeeData || {};
  const employeeData: EmployeeData = {
    employeeNumber: String(rawEmp.employeeNumber ?? '').trim(),
    position: String(rawEmp.position ?? '').trim(),
    department: String(rawEmp.department ?? '').trim(),
    personalCode: String(rawEmp.personalCode ?? '').trim(),
    bankIban: String(rawEmp.bankIban ?? '').trim().toUpperCase(),
  };

  return {
    personFirstName: firstName,
    personLastName: lastName,
    personTitle,
    personEmail: String(v.personEmail ?? '').trim(),
    personPhone: String(v.personPhone ?? '').trim(),
    isActive: v.isActive !== false,
    personIsEmployee: Boolean(v.personIsEmployee),
    // not edited by the person form: kept as it is
    personType: v.personType || null,
    employeeData,
  };
}

export type PersonErrors = {
  [K in keyof PersonRowJSON]?: string;
} & {
  employeeNumber?: string;
  position?: string;
  department?: string;
  personalCode?: string;
  bankIban?: string;
};

/** Validate person fields. */
export function validatePerson(v: PersonRowJSON, rows: Pick<PersonRow, 'rowGUID' | 'rowJSON'>[] = [], rowGUID?: string | null): PersonErrors {
  const e: PersonErrors = {};
  if (!v.personFirstName) e.personFirstName = 'First name is required.';
  if (v.personEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.personEmail)) {
    e.personEmail = 'Invalid email address format.';
  }

  // Employee validations apply only if personIsEmployee is true
  if (v.personIsEmployee && v.employeeData) {
    if (!v.employeeData.employeeNumber && !v.employeeData.personalCode) {
      e.employeeNumber = 'Employee number or personal code is required for employees.';
    }
  }

  return e;
}

/** Row -> card of ListWebCardsComponent (title / description drive its search). */
export function personToCard(row: any, idx = 0) {
  const j: Partial<PersonRowJSON> = row?.rowJSON || {};
  const title = j.personTitle || [j.personFirstName, j.personLastName].filter(Boolean).join(' ') || 'Unnamed Person';
  const roleParts: string[] = [];
  if (j.personIsEmployee) roleParts.push('Employee');
  if (j.employeeData?.position) roleParts.push(j.employeeData.position);
  if (j.personEmail) roleParts.push(j.personEmail);
  if (j.personPhone) roleParts.push(j.personPhone);
  if (j.isActive === false) roleParts.push('inactive');

  return {
    id: row?.rowGUID || `person-${idx + 1}`,
    title,
    description: roleParts.filter(Boolean).join(' · '),
    orderInList: row?.orderInList,
    rawItem: row,
  };
}
