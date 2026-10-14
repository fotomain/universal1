// The equipment side of the database as the equipment part of start1_sql_tables.sql + start2_sql_code.sql (PART 17) leaves it (shortened: 3 equipment, 2 types),
// on top of the descriptors. Helpers to put it together with the rows of the other sides (the descriptor tables are shared).
import { emptyEquipmentCatalogData, EquipmentCatalogData } from '../../../kit8/catalog/equipment/equipmentTypeModel';

const row = (rowGUID: string, rowOwnerGUID: string, rowParentGUID: string, rowJSON: any, orderInList = 0) => ({ rowGUID, rowOwnerGUID, rowParentGUID, orderInList, rowJSON });

export const equipmentTypes = () => [
  row('equipmentTypeHeavy', 'equipmentTypeCatalog', 'empty', { title: 'Heavy machinery', propertySet: 'ds_eqh_prop', variantSet: 'ds_eqh_var', variantMode: 'perProduct', uniqueVariants: true, variantTitleTemplate: '{equipmentClass}, {hireMode}', isActive: true }, 1000),
  row('equipmentTypeVehicle', 'equipmentTypeCatalog', 'empty', { title: 'Vehicle', propertySet: 'ds_eqv_prop', variantSet: 'ds_eqv_var', variantMode: 'perProduct', uniqueVariants: true, variantTitleTemplate: '{equipmentClass}, {hireMode}', isActive: true }, 2000),
];

export const equipmentGenus = () => [
  row('equipmentClass', 'descriptorGenusCatalog', 'empty', { title: 'Class', valueType: 'ref', allowedDescriptionModes: ['variant'], targetKinds: ['equipmentType', 'resourceRoleType'] }),
  row('hireMode', 'descriptorGenusCatalog', 'empty', { title: 'Hire mode', valueType: 'ref', allowedDescriptionModes: ['variant'], targetKinds: ['equipmentType', 'resourceRoleType'] }),
  row('enginePowerKw', 'descriptorGenusCatalog', 'empty', { title: 'Engine power, kW', valueType: 'number', unit: 'kW', allowedDescriptionModes: ['property'], targetKinds: ['equipmentType'], satisfies: 'minEnginePowerKw', matchRule: 'atLeast' }),
  row('minEnginePowerKw', 'descriptorGenusCatalog', 'empty', { title: 'Min. engine power, kW', valueType: 'number', unit: 'kW', allowedDescriptionModes: ['property'], targetKinds: ['resourceRoleType'] }),
  row('yearOfManufacture', 'descriptorGenusCatalog', 'empty', { title: 'Year of manufacture', valueType: 'number', allowedDescriptionModes: ['property'], targetKinds: ['equipmentType'] }),
];
export const equipmentValues = () => [
  row('dv_eqc_light', 'equipmentClass', 'empty', { title: 'Light', sort: 10 }), row('dv_eqc_medium', 'equipmentClass', 'empty', { title: 'Medium', sort: 20 }), row('dv_eqc_heavy', 'equipmentClass', 'empty', { title: 'Heavy', sort: 30 }),
  row('dv_hm_dry', 'hireMode', 'empty', { title: 'Dry hire', sort: 10 }), row('dv_hm_op', 'hireMode', 'empty', { title: 'With operator', sort: 20 }),
];
export const equipmentSets = () => [
  row('ds_eqh_prop', 'equipmentTypeHeavy', 'property', { title: 'Heavy machinery – properties' }), row('ds_eqh_var', 'equipmentTypeHeavy', 'variant', { title: 'Heavy machinery – variants' }),
  row('ds_eqv_prop', 'equipmentTypeVehicle', 'property', { title: 'Vehicle – properties' }), row('ds_eqv_var', 'equipmentTypeVehicle', 'variant', { title: 'Vehicle – variants' }),
];
export const equipmentPlan = () => [
  row('dp_eqh_p1', 'ds_eqh_prop', 'enginePowerKw', { required: true, sort: 10 }), row('dp_eqh_p2', 'ds_eqh_prop', 'yearOfManufacture', { required: false, sort: 20 }),
  row('dp_eqh_v1', 'ds_eqh_var', 'equipmentClass', { required: true, sort: 10, inVariantTitle: true }), row('dp_eqh_v2', 'ds_eqh_var', 'hireMode', { required: true, sort: 20, inVariantTitle: true }),
  row('dp_eqv_p1', 'ds_eqv_prop', 'enginePowerKw', { required: true, sort: 10 }), row('dp_eqv_p2', 'ds_eqv_prop', 'yearOfManufacture', { required: false, sort: 20 }),
  row('dp_eqv_v1', 'ds_eqv_var', 'equipmentClass', { required: true, sort: 10, inVariantTitle: true }), row('dp_eqv_v2', 'ds_eqv_var', 'hireMode', { required: true, sort: 20, inVariantTitle: true }),
];

/** 3 equipment: two heavy machines and a van */
export const equipment = () => [
  row('eq_cat320', 'equipmentCatalog', 'empty', { equipmentTitle: 'Excavator CAT 320', equipmentCode: 'EQ-001', equipmentType: 'equipmentTypeHeavy', equipmentOwnership: 'own', equipmentManufacturer: 'Caterpillar', equipmentModel: '320', isActive: true }, 1000),
  row('eq_jcb3cx', 'equipmentCatalog', 'empty', { equipmentTitle: 'Backhoe loader JCB 3CX', equipmentCode: 'EQ-002', equipmentType: 'equipmentTypeHeavy', equipmentOwnership: 'rented', isActive: true }, 2000),
  row('eq_crafter', 'equipmentCatalog', 'empty', { equipmentTitle: 'Delivery van VW Crafter', equipmentCode: 'EQ-005', equipmentType: 'equipmentTypeVehicle', equipmentOwnership: 'own', isActive: true }, 5000),
];

export function equipmentData() {
  const propertyValue = [
    row('pp_eq_pow_eq_cat320', 'eq_cat320', 'dp_eqh_p1', { value: 122 }), row('pp_eq_year_eq_cat320', 'eq_cat320', 'dp_eqh_p2', { value: 2019 }),
    row('pp_eq_pow_eq_jcb3cx', 'eq_jcb3cx', 'dp_eqh_p1', { value: 55 }),
    row('pp_eq_pow_eq_crafter', 'eq_crafter', 'dp_eqv_p1', { value: 103 }),
  ];
  const variant = [
    row('evar_eq_cat320_a', 'eq_cat320', 'empty', { title: 'Heavy, With operator', descriptorKey: 'dp_eqh_v1=dv_eqc_heavy|dp_eqh_v2=dv_hm_op', isActive: true }, 1),
    row('evar_eq_cat320_b', 'eq_cat320', 'empty', { title: 'Heavy, Dry hire', descriptorKey: 'dp_eqh_v1=dv_eqc_heavy|dp_eqh_v2=dv_hm_dry', isActive: true }, 2),
    row('evar_eq_jcb3cx_a', 'eq_jcb3cx', 'empty', { title: 'Medium, With operator', descriptorKey: 'dp_eqh_v1=dv_eqc_medium|dp_eqh_v2=dv_hm_op', isActive: true }, 1),
    row('evar_eq_crafter_a', 'eq_crafter', 'empty', { title: 'Light, With operator', descriptorKey: 'dp_eqv_v1=dv_eqc_light|dp_eqv_v2=dv_hm_op', isActive: true }, 1),
  ];
  const variantValue = [
    row('evv_cat_a_c', 'evar_eq_cat320_a', 'dp_eqh_v1', { descriptorValueGUID: 'dv_eqc_heavy' }), row('evv_cat_a_h', 'evar_eq_cat320_a', 'dp_eqh_v2', { descriptorValueGUID: 'dv_hm_op' }),
    row('evv_cat_b_c', 'evar_eq_cat320_b', 'dp_eqh_v1', { descriptorValueGUID: 'dv_eqc_heavy' }), row('evv_cat_b_h', 'evar_eq_cat320_b', 'dp_eqh_v2', { descriptorValueGUID: 'dv_hm_dry' }),
    row('evv_jcb_a_c', 'evar_eq_jcb3cx_a', 'dp_eqh_v1', { descriptorValueGUID: 'dv_eqc_medium' }), row('evv_jcb_a_h', 'evar_eq_jcb3cx_a', 'dp_eqh_v2', { descriptorValueGUID: 'dv_hm_op' }),
    row('evv_van_a_c', 'evar_eq_crafter_a', 'dp_eqv_v1', { descriptorValueGUID: 'dv_eqc_light' }), row('evv_van_a_h', 'evar_eq_crafter_a', 'dp_eqv_v2', { descriptorValueGUID: 'dv_hm_op' }),
  ];
  return { propertyValue, variant, variantValue };
}

/** the equipment side as the equipment dashboard reads it (own rows only) */
export function seedEquipmentCatalog(): EquipmentCatalogData {
  const d = emptyEquipmentCatalogData();
  d.equipmentType = equipmentTypes();
  d.equipment = equipment();
  d.descriptorGenus = equipmentGenus();
  d.descriptorValue = equipmentValues();
  d.descriptorDestination = equipmentSets();
  d.descriptorPlan = equipmentPlan();
  Object.assign(d, equipmentData());
  return d;
}
