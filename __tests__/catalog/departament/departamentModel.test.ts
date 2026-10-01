import {
  departamentTable,
  DEPARTAMENT_ENTITY,
  emptyDepartament,
  normalizeDepartament,
  validateDepartament,
  canSelectParentDepartament,
  getDescendantGUIDs,
  buildDepartamentTree,
  flattenDepartamentTree,
  departamentToCard,
  DepartamentRow,
} from '../../../kit8/catalog/departament/departamentModel';

describe('departamentModel', () => {
  const orgGUID = 'org-univ-001';

  it('defines correct table and entity constants following defTable.md', () => {
    expect(departamentTable).toBe('departamentTable');
    expect(DEPARTAMENT_ENTITY).toBe('departamentReusable');
  });

  it('creates empty department with owner organization GUID and empty parent', () => {
    const empty = emptyDepartament(orgGUID);
    expect(empty.rowOwnerGUID).toBe(orgGUID);
    expect(empty.rowParentGUID).toBe('empty');
    expect(empty.rowJSON.departmentName).toBe('');
    expect(empty.rowJSON.isActive).toBe(true);
  });

  it('normalizes department fields properly', () => {
    const normalized = normalizeDepartament({
      departmentName: '  Engineering  ',
      departmentCode: 'eng',
      description: '  Main engineering team  ',
      headPersonGUID: '  person-001  ',
      headPersonName: '  John Doe  ',
    });

    expect(normalized.departmentName).toBe('Engineering');
    expect(normalized.departmentCode).toBe('ENG');
    expect(normalized.description).toBe('Main engineering team');
    expect(normalized.headPersonGUID).toBe('person-001');
    expect(normalized.headPersonName).toBe('John Doe');
    expect(normalized.isActive).toBe(true);
  });

  it('validates required fields', () => {
    const invalid = validateDepartament({}, '');
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.departmentName).toBeDefined();
    expect(invalid.errors.rowOwnerGUID).toBeDefined();

    const valid = validateDepartament({ departmentName: 'Marketing' }, orgGUID);
    expect(valid.valid).toBe(true);
  });

  describe('hierarchy, trees and cycle prevention', () => {
    const sampleRows: DepartamentRow[] = [
      {
        rowGUID: 'dept-head',
        rowOwnerGUID: orgGUID,
        rowParentGUID: 'empty',
        orderInList: 0,
        rowJSON: { departmentName: 'Headquarters', isActive: true },
      },
      {
        rowGUID: 'dept-tech',
        rowOwnerGUID: orgGUID,
        rowParentGUID: 'dept-head',
        orderInList: 0,
        rowJSON: { departmentName: 'Technology Division', isActive: true },
      },
      {
        rowGUID: 'dept-eng',
        rowOwnerGUID: orgGUID,
        rowParentGUID: 'dept-tech',
        orderInList: 0,
        rowJSON: { departmentName: 'Software Engineering', isActive: true },
      },
      {
        rowGUID: 'dept-qa',
        rowOwnerGUID: orgGUID,
        rowParentGUID: 'dept-tech',
        orderInList: 1,
        rowJSON: { departmentName: 'Quality Assurance', isActive: true },
      },
      {
        rowGUID: 'dept-ops',
        rowOwnerGUID: orgGUID,
        rowParentGUID: 'dept-head',
        orderInList: 1,
        rowJSON: { departmentName: 'Operations', isActive: true },
      },
    ];

    it('builds a tree from flat department rows', () => {
      const tree = buildDepartamentTree(sampleRows);
      expect(tree.length).toBe(1); // One root: Headquarters
      expect(tree[0].row.rowGUID).toBe('dept-head');
      expect(tree[0].depth).toBe(0);
      expect(tree[0].children.length).toBe(2); // Technology Division, Operations

      const techNode = tree[0].children[0];
      expect(techNode.row.rowGUID).toBe('dept-tech');
      expect(techNode.depth).toBe(1);
      expect(techNode.children.length).toBe(2); // Software Engineering, QA

      const engNode = techNode.children[0];
      expect(engNode.row.rowGUID).toBe('dept-eng');
      expect(engNode.depth).toBe(2);
      expect(engNode.children.length).toBe(0);
    });

    it('flattens tree into depth-first hierarchy list with correct depth and hasChildren', () => {
      const flat = flattenDepartamentTree(sampleRows);
      expect(flat.length).toBe(5);

      expect(flat[0].row.rowGUID).toBe('dept-head');
      expect(flat[0].depth).toBe(0);
      expect(flat[0].hasChildren).toBe(true);

      expect(flat[1].row.rowGUID).toBe('dept-tech');
      expect(flat[1].depth).toBe(1);
      expect(flat[1].hasChildren).toBe(true);

      expect(flat[2].row.rowGUID).toBe('dept-eng');
      expect(flat[2].depth).toBe(2);
      expect(flat[2].hasChildren).toBe(false);

      expect(flat[3].row.rowGUID).toBe('dept-qa');
      expect(flat[3].depth).toBe(2);
      expect(flat[3].hasChildren).toBe(false);

      expect(flat[4].row.rowGUID).toBe('dept-ops');
      expect(flat[4].depth).toBe(1);
      expect(flat[4].hasChildren).toBe(false);
    });

    it('detects descendants correctly to prevent cycles', () => {
      const descendants = getDescendantGUIDs('dept-head', sampleRows);
      expect(descendants.has('dept-tech')).toBe(true);
      expect(descendants.has('dept-eng')).toBe(true);
      expect(descendants.has('dept-qa')).toBe(true);
      expect(descendants.has('dept-ops')).toBe(true);

      const techDescendants = getDescendantGUIDs('dept-tech', sampleRows);
      expect(techDescendants.has('dept-eng')).toBe(true);
      expect(techDescendants.has('dept-qa')).toBe(true);
      expect(techDescendants.has('dept-ops')).toBe(false);
      expect(techDescendants.has('dept-head')).toBe(false);
    });

    it('canSelectParentDepartament returns false if target parent is current department or its descendant', () => {
      // Cannot set itself as parent
      expect(canSelectParentDepartament('dept-tech', 'dept-tech', sampleRows)).toBe(false);

      // Cannot set its own child (dept-eng) as parent for dept-tech
      expect(canSelectParentDepartament('dept-eng', 'dept-tech', sampleRows)).toBe(false);

      // CAN set sibling (dept-ops) or parent (dept-head)
      expect(canSelectParentDepartament('dept-ops', 'dept-eng', sampleRows)).toBe(true);
      expect(canSelectParentDepartament('dept-head', 'dept-eng', sampleRows)).toBe(true);
    });

    it('validateDepartament catches self-parenting and circular references', () => {
      const selfParent = validateDepartament(
        { departmentName: 'Tech' },
        orgGUID,
        'dept-tech',
        'dept-tech',
        sampleRows
      );
      expect(selfParent.valid).toBe(false);
      expect(selfParent.errors.rowParentGUID).toContain('cannot be its own parent');

      const cycle = validateDepartament(
        { departmentName: 'Tech' },
        orgGUID,
        'dept-tech',
        'dept-eng', // dept-eng is descendant of dept-tech!
        sampleRows
      );
      expect(cycle.valid).toBe(false);
      expect(cycle.errors.rowParentGUID).toContain('Circular hierarchy');
    });

    it('maps department row to card item with depth and hasChildren for ListWebCardsComponent', () => {
      const card = departamentToCard(sampleRows[1], 1, 1, true);
      expect(card.id).toBe('dept-tech');
      expect(card.title).toBe('Technology Division');
      expect(card.depth).toBe(1);
      expect(card.hasChildren).toBe(true);
      expect(card.parentId).toBe('dept-head');
    });
  });
});
