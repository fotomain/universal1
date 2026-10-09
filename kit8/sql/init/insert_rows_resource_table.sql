-- =====================================================================================
-- UNIVERSAL1 - RESOURCE ROWS: kit8/sql/init/insert_rows_resource_table.sql
-- Demo rows for the three kinds of resources of the management genus (kit8/catalog/resourcerole, kit8/catalog/management/genus):
--   1. Human Resources    (resourceRoleTypeTable.rowJSON.managementGenus = timeGenus)      5 roles: Project Manager, Business Analyst, Data Analyst,
--                                                                                         Frontend Developer, Backend Developer - hourly rates, Senior / Middle variants
--   2. Material Resources (materialGenus)                                                  10 roles: Wood plate 20x20, Birch plate 20x20, Oak board, plywood, steel profile,
--                                                                                         aluminium sheet, copper cable, wood screws, varnish, epoxy resin
--   3. Expense Resources  (expenseGenus)                                                   10 roles in the domains Logistic, Transport, Advertisement, Service
--   4. Revenue Resources  (revenueGenus)                                                   2 roles: Stage #1 Revenue, Stage #2 Revenue (a Bill rate each, per stage)
-- VAT: an empty VAT of a role type becomes 0 % (vat_0; a role with no VAT of its own uses its type's rate, so no resource is left without one).
-- VAT 21 % (vat_21): on every Material role itself and on both Revenue roles (roleVATRate); Human / Expense roles use the 21 % default of their role type.
-- Every human, material and expense role has a Bill rate (what the customer pays) and a Cost rate (what it costs the company) per ITS unit (hour, pcs, m, m2, l, kg, km, day, month).
-- Also sets managementGenus = timeGenus on the five role types of the sheet (projectManager ... backendDeveloper) when they have none.
--
-- RUN AFTER create_product_tables.sql, create_resource_role_tables.sql and create_management_genus_table.sql.
-- IDEMPOTENT + NON-DESTRUCTIVE: seeds ON CONFLICT DO NOTHING (a row you changed or deleted is left alone).
-- Rows: measureUnitTable 5, resourceRoleFolderTable 11, resourceRoleTypeTable 4, descriptorDestinationTable 2, descriptorPlanTable 4, variantTable 3, variantValueTable 6, resourceRoleTable 27, propertyValueTable 8, rolePriceTable 57
-- =====================================================================================

DO $$
BEGIN
  IF to_regclass('public."resourceRoleTypeTable"') IS NULL OR to_regclass('public."rolePriceTable"') IS NULL THEN
    RAISE EXCEPTION 'Run kit8/sql/init/create_product_tables.sql and create_resource_role_tables.sql first';
  END IF;
  IF to_regclass('public."managementGenusTable"') IS NULL THEN
    RAISE EXCEPTION 'Run kit8/sql/init/create_management_genus_table.sql first';
  END IF;
  IF (SELECT count(*) FROM public."managementGenusTable" WHERE "rowGUID" IN ('timeGenus', 'materialGenus', 'expenseGenus')) < 3 THEN
    RAISE EXCEPTION 'managementGenusTable has no timeGenus / materialGenus / expenseGenus: run kit8/sql/init/create_management_genus_table.sql';
  END IF;
END $$;

-- the five role types of the sheet are time resources
UPDATE public."resourceRoleTypeTable"
   SET "rowJSON" = jsonb_set("rowJSON", '{managementGenus}', '"timeGenus"'::jsonb)
 WHERE "rowGUID" IN ('projectManager', 'businessAnalyst', 'dataAnalyst', 'frontendDeveloper', 'backendDeveloper')
   AND coalesce("rowJSON"->>'managementGenus', '') = '';

-- a resource with an empty VAT is a 0 % resource: role types without a default VAT rate get 0 % (a role with its own rate keeps it; a role with none uses its role type's rate)
INSERT INTO public."valueAddedTaxTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
  VALUES ('vat_0', 'valueAddedTaxCatalog', 'empty', 7000, '{"vatTableTitle": "0 %", "vatTablePercent": 0}'::jsonb)
  ON CONFLICT ("rowGUID") DO NOTHING;
UPDATE public."resourceRoleTypeTable"
   SET "rowJSON" = jsonb_set("rowJSON", '{roleVATDefaultRate}', '"vat_0"'::jsonb)
 WHERE coalesce("rowJSON"->>'roleVATDefaultRate', '') = '';

-- the material roles carry VAT 21 % themselves (also when they were inserted by an earlier version of this script)
UPDATE public."resourceRoleTable"
   SET "rowJSON" = jsonb_set("rowJSON", '{roleVATRate}', '"vat_21"'::jsonb)
 WHERE "rowOwnerGUID" = 'materialResources' AND coalesce("rowJSON"->>'roleVATRate', '') = '';

-- measureUnitTable: 5 rows - units for materials and expenses: metre, square metre, kilometre, day, month (pcs, kg, l, hour exist)
INSERT INTO public."measureUnitTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('unit_m', 'measureUnitCatalog', 'empty', 7000, '{"title": "m", "code": "006"}'::jsonb),
  ('unit_m2', 'measureUnitCatalog', 'empty', 8000, '{"title": "m²", "code": "055"}'::jsonb),
  ('unit_km', 'measureUnitCatalog', 'empty', 9000, '{"title": "km", "code": "008"}'::jsonb),
  ('unit_day', 'measureUnitCatalog', 'empty', 10000, '{"title": "day", "code": "359"}'::jsonb),
  ('unit_month', 'measureUnitCatalog', 'empty', 11000, '{"title": "month", "code": "362"}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- resourceRoleFolderTable: 11 rows - folders: Human resources, Materials (3 groups), Expenses (the 4 domains), Revenues
INSERT INTO public."resourceRoleFolderTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('fld_res_hr', 'resourceRoleFolderCatalog', 'empty', 6000, '{"title": "Human resources"}'::jsonb),
  ('fld_res_mat', 'resourceRoleFolderCatalog', 'empty', 7000, '{"title": "Materials"}'::jsonb),
  ('fld_res_mat_wood', 'resourceRoleFolderCatalog', 'fld_res_mat', 8000, '{"title": "Wood & boards"}'::jsonb),
  ('fld_res_mat_metal', 'resourceRoleFolderCatalog', 'fld_res_mat', 9000, '{"title": "Metal & cables"}'::jsonb),
  ('fld_res_mat_finish', 'resourceRoleFolderCatalog', 'fld_res_mat', 10000, '{"title": "Finishing & fasteners"}'::jsonb),
  ('fld_res_exp', 'resourceRoleFolderCatalog', 'empty', 11000, '{"title": "Expenses"}'::jsonb),
  ('fld_res_exp_logistic', 'resourceRoleFolderCatalog', 'fld_res_exp', 12000, '{"title": "Logistic"}'::jsonb),
  ('fld_res_exp_transport', 'resourceRoleFolderCatalog', 'fld_res_exp', 13000, '{"title": "Transport"}'::jsonb),
  ('fld_res_exp_advert', 'resourceRoleFolderCatalog', 'fld_res_exp', 14000, '{"title": "Advertisement"}'::jsonb),
  ('fld_res_exp_service', 'resourceRoleFolderCatalog', 'fld_res_exp', 15000, '{"title": "Service"}'::jsonb),
  ('fld_res_rev', 'resourceRoleFolderCatalog', 'empty', 16000, '{"title": "Revenues"}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- resourceRoleTypeTable: 4 rows - four role types, each with its management genus: Human Resources = timeGenus, Material Resources = materialGenus, Expense Resources = expenseGenus, Revenue Resources = revenueGenus (all with VAT 21 %)
INSERT INTO public."resourceRoleTypeTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('humanResources', 'resourceRoleTypeCatalog', 'empty', 6000, '{"title": "Human Resources", "description": "People booked by the hour: project management, analysis and development. Costed and invoiced per hour; the level (seniority, language) is a variant with its own rate.", "managementGenus": "timeGenus", "baseUnit": "unit_hour", "roleVATDefaultRate": "vat_21", "propertySet": "ds_hr_prop", "variantSet": "ds_hr_var", "variantMode": "perType", "uniqueVariants": true, "variantTitleTemplate": "{seniority}, {workLanguage}", "isActive": true}'::jsonb),
  ('materialResources', 'resourceRoleTypeCatalog', 'empty', 7000, '{"title": "Material Resources", "description": "Materials and supplies the work consumes. Bought and re-invoiced per piece, metre, square metre, litre or kg - the unit is the one of the rate.", "managementGenus": "materialGenus", "baseUnit": "unit_pcs", "roleVATDefaultRate": "vat_21", "propertySet": null, "variantSet": null, "variantMode": "none", "uniqueVariants": true, "variantTitleTemplate": null, "isActive": true}'::jsonb),
  ('expenseResources', 'resourceRoleTypeCatalog', 'empty', 8000, '{"title": "Expense Resources", "description": "Other expenses of the work in four domains - Logistic, Transport, Advertisement, Service - re-invoiced to the customer.", "managementGenus": "expenseGenus", "baseUnit": "unit_pcs", "roleVATDefaultRate": "vat_21", "propertySet": null, "variantSet": null, "variantMode": "none", "uniqueVariants": true, "variantTitleTemplate": null, "isActive": true}'::jsonb),
  ('revenueResources', 'resourceRoleTypeCatalog', 'empty', 9000, '{"title": "Revenue Resources", "description": "What the customers are invoiced for: one revenue item per project stage, invoiced per stage (1 pcs = 1 stage).", "managementGenus": "revenueGenus", "baseUnit": "unit_pcs", "roleVATDefaultRate": "vat_21", "propertySet": null, "variantSet": null, "variantMode": "none", "uniqueVariants": true, "variantTitleTemplate": null, "isActive": true}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- descriptorDestinationTable: 2 rows - Human Resources: one Property set and one Variant set (as the role types of the sheet)
INSERT INTO public."descriptorDestinationTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('ds_hr_prop', 'humanResources', 'property', 11000, '{"title": "Human Resources – properties"}'::jsonb),
  ('ds_hr_var', 'humanResources', 'variant', 12000, '{"title": "Human Resources – variants"}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- descriptorPlanTable: 4 rows - their descriptors: min. experience, certification / seniority, working language
INSERT INTO public."descriptorPlanTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('dp_hr_exp', 'ds_hr_prop', 'minExperienceYears', 101000, '{"required": true, "sort": 10, "showInCard": true}'::jsonb),
  ('dp_hr_cert', 'ds_hr_prop', 'certification', 102000, '{"required": false, "sort": 20, "showInCard": true}'::jsonb),
  ('dp_hr_sen', 'ds_hr_var', 'seniority', 103000, '{"required": true, "sort": 10, "inVariantTitle": true}'::jsonb),
  ('dp_hr_lang', 'ds_hr_var', 'workLanguage', 104000, '{"required": true, "sort": 20, "inVariantTitle": true}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- resourceRoleTable: 27 rows - Human Resources: 5 roles - Materials: 10 (VAT 21 % on each) - Expenses: 10 (Logistic 3, Transport 3, Advertisement 2, Service 2) - Revenues: Stage #1 Revenue, Stage #2 Revenue (VAT 21 %)
INSERT INTO public."resourceRoleTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('hr_pm', 'humanResources', 'fld_res_hr', 9000, '{"title": "Project Manager", "description": "Plans scope, schedule and budget; leads the team and reports to the customer.", "roleVATRate": null, "isActive": true}'::jsonb),
  ('hr_ba', 'humanResources', 'fld_res_hr', 10000, '{"title": "Business Analyst", "description": "Collects requirements, writes specifications and acceptance criteria.", "roleVATRate": null, "isActive": true}'::jsonb),
  ('hr_da', 'humanResources', 'fld_res_hr', 11000, '{"title": "Data Analyst", "description": "Prepares data, builds reports and dashboards, explains results to the business.", "roleVATRate": null, "isActive": true}'::jsonb),
  ('hr_fe', 'humanResources', 'fld_res_hr', 12000, '{"title": "Frontend Developer", "description": "Builds the user interface: web and mobile screens.", "roleVATRate": null, "isActive": true}'::jsonb),
  ('hr_be', 'humanResources', 'fld_res_hr', 13000, '{"title": "Backend Developer", "description": "Builds server logic, the database and integrations (API).", "roleVATRate": null, "isActive": true}'::jsonb),
  ('mat_wood_plate_20', 'materialResources', 'fld_res_mat_wood', 14000, '{"title": "Wood plate 20x20", "description": "Pine plate 200 x 200 mm, 18 mm thick, planed on four sides. Craft and furniture parts.", "roleVATRate": "vat_21", "isActive": true}'::jsonb),
  ('mat_birch_plate_20', 'materialResources', 'fld_res_mat_wood', 15000, '{"title": "Birch plate 20x20", "description": "Birch plywood plate 200 x 200 mm, 18 mm thick, sanded. Visible parts, light colour.", "roleVATRate": "vat_21", "isActive": true}'::jsonb),
  ('mat_oak_board', 'materialResources', 'fld_res_mat_wood', 16000, '{"title": "Oak board 2000x200x25", "description": "Kiln-dried oak board, 2000 x 200 x 25 mm, rough sawn. Table tops and shelves.", "roleVATRate": "vat_21", "isActive": true}'::jsonb),
  ('mat_plywood_sheet', 'materialResources', 'fld_res_mat_wood', 17000, '{"title": "Plywood sheet 1250x2500x18", "description": "Birch plywood BB/BB, 1250 x 2500 mm, 18 mm. Cabinets and floors.", "roleVATRate": "vat_21", "isActive": true}'::jsonb),
  ('mat_steel_profile', 'materialResources', 'fld_res_mat_metal', 18000, '{"title": "Steel profile 40x40x2", "description": "Galvanised square steel tube 40 x 40 x 2 mm, 6 m bars. Frames and stands; price per metre.", "roleVATRate": "vat_21", "isActive": true}'::jsonb),
  ('mat_alu_sheet', 'materialResources', 'fld_res_mat_metal', 19000, '{"title": "Aluminium sheet 1.5 mm", "description": "Aluminium sheet EN AW-5754, 1.5 mm. Covers and panels; price per square metre.", "roleVATRate": "vat_21", "isActive": true}'::jsonb),
  ('mat_copper_cable', 'materialResources', 'fld_res_mat_metal', 20000, '{"title": "Copper cable 3x2.5 mm²", "description": "Installation cable NYM-J 3 x 2.5 mm², 450 / 750 V; price per metre.", "roleVATRate": "vat_21", "isActive": true}'::jsonb),
  ('mat_wood_screws', 'materialResources', 'fld_res_mat_finish', 21000, '{"title": "Wood screws 4x40 (box of 200)", "description": "Countersunk wood screws 4 x 40 mm, zinc plated, Torx; box of 200 pieces.", "roleVATRate": "vat_21", "isActive": true}'::jsonb),
  ('mat_varnish', 'materialResources', 'fld_res_mat_finish', 22000, '{"title": "Wood varnish, matt", "description": "Water-based matt varnish for wood, about 10 m² per litre; price per litre.", "roleVATRate": "vat_21", "isActive": true}'::jsonb),
  ('mat_epoxy', 'materialResources', 'fld_res_mat_finish', 23000, '{"title": "Epoxy resin, 2-component", "description": "Clear two-component epoxy resin with hardener, for casting and gluing; price per kg.", "roleVATRate": "vat_21", "isActive": true}'::jsonb),
  ('exp_warehouse', 'expenseResources', 'fld_res_exp_logistic', 24000, '{"title": "Warehouse storage, pallet place", "description": "Dry heated warehouse, one pallet place (EUR pallet), per month.", "roleVATRate": null, "isActive": true}'::jsonb),
  ('exp_pallet_handling', 'expenseResources', 'fld_res_exp_logistic', 25000, '{"title": "Pallet handling (loading / unloading)", "description": "Forklift loading or unloading of one pallet.", "roleVATRate": null, "isActive": true}'::jsonb),
  ('exp_customs', 'expenseResources', 'fld_res_exp_logistic', 26000, '{"title": "Customs clearance, per declaration", "description": "Import / export declaration prepared and lodged by a customs broker.", "roleVATRate": null, "isActive": true}'::jsonb),
  ('exp_van', 'expenseResources', 'fld_res_exp_transport', 27000, '{"title": "Van delivery, up to 1.2 t", "description": "Van with driver, up to 1.2 t / 8 pallet-places, per kilometre driven.", "roleVATRate": null, "isActive": true}'::jsonb),
  ('exp_truck', 'expenseResources', 'fld_res_exp_transport', 28000, '{"title": "Truck freight, 20 t", "description": "Full truck load up to 20 t / 33 pallet-places, per kilometre driven.", "roleVATRate": null, "isActive": true}'::jsonb),
  ('exp_courier', 'expenseResources', 'fld_res_exp_transport', 29000, '{"title": "Courier express parcel, up to 10 kg", "description": "Next-day door-to-door delivery of one parcel up to 10 kg inside the country.", "roleVATRate": null, "isActive": true}'::jsonb),
  ('exp_social', 'expenseResources', 'fld_res_exp_advert', 30000, '{"title": "Social media ad campaign", "description": "Paid campaign on social networks (targeting, creatives, reporting), per day of running.", "roleVATRate": null, "isActive": true}'::jsonb),
  ('exp_billboard', 'expenseResources', 'fld_res_exp_advert', 31000, '{"title": "Billboard rental, city centre", "description": "Illuminated 12 m² billboard in the city centre, per month.", "roleVATRate": null, "isActive": true}'::jsonb),
  ('exp_maintenance', 'expenseResources', 'fld_res_exp_service', 32000, '{"title": "Equipment maintenance visit", "description": "Technician visit for the service and repair of equipment, per hour on site.", "roleVATRate": null, "isActive": true}'::jsonb),
  ('exp_cleaning', 'expenseResources', 'fld_res_exp_service', 33000, '{"title": "Cleaning service, office", "description": "Regular cleaning of office premises, per square metre cleaned.", "roleVATRate": null, "isActive": true}'::jsonb),
  ('rev_stage_1', 'revenueResources', 'fld_res_rev', 34000, '{"title": "Stage #1 Revenue", "description": "Invoice of stage #1 of the project: what the customer pays when the first stage is accepted.", "roleVATRate": "vat_21", "isActive": true}'::jsonb),
  ('rev_stage_2', 'revenueResources', 'fld_res_rev', 35000, '{"title": "Stage #2 Revenue", "description": "Invoice of stage #2 of the project: what the customer pays when the second stage is accepted.", "roleVATRate": "vat_21", "isActive": true}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- propertyValueTable: 8 rows - requirements of the human roles (owner = role)
INSERT INTO public."propertyValueTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('pp_hr_pm_exp', 'hr_pm', 'dp_hr_exp', 700000, '{"value": 5}'::jsonb),
  ('pp_hr_pm_cert', 'hr_pm', 'dp_hr_cert', 701000, '{"descriptorValueGUID": "dv18"}'::jsonb),
  ('pp_hr_ba_exp', 'hr_ba', 'dp_hr_exp', 702000, '{"value": 3}'::jsonb),
  ('pp_hr_ba_cert', 'hr_ba', 'dp_hr_cert', 703000, '{"descriptorValueGUID": "dv21"}'::jsonb),
  ('pp_hr_da_exp', 'hr_da', 'dp_hr_exp', 704000, '{"value": 2}'::jsonb),
  ('pp_hr_da_cert', 'hr_da', 'dp_hr_cert', 705000, '{"descriptorValueGUID": "dv20"}'::jsonb),
  ('pp_hr_fe_exp', 'hr_fe', 'dp_hr_exp', 706000, '{"value": 2}'::jsonb),
  ('pp_hr_be_exp', 'hr_be', 'dp_hr_exp', 707000, '{"value": 3}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- variantTable: 3 rows - bookable levels of Human Resources (owner = role type, perType)
INSERT INTO public."variantTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('pv_hr_mid_en', 'humanResources', 'empty', 600000, '{"title": "Middle, English", "descriptorKey": "dp_hr_lang=dv15|dp_hr_sen=dv12", "isActive": true}'::jsonb),
  ('pv_hr_sen_en', 'humanResources', 'empty', 601000, '{"title": "Senior, English", "descriptorKey": "dp_hr_lang=dv15|dp_hr_sen=dv13", "isActive": true}'::jsonb),
  ('pv_hr_sen_lv', 'humanResources', 'empty', 602000, '{"title": "Senior, Latvian", "descriptorKey": "dp_hr_lang=dv16|dp_hr_sen=dv13", "isActive": true}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- variantValueTable: 6 rows - descriptor values of those variants
INSERT INTO public."variantValueTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('pvd_hr_mid_en_sen', 'pv_hr_mid_en', 'dp_hr_sen', 600000, '{"descriptorValueGUID": "dv12"}'::jsonb),
  ('pvd_hr_mid_en_lang', 'pv_hr_mid_en', 'dp_hr_lang', 601000, '{"descriptorValueGUID": "dv15"}'::jsonb),
  ('pvd_hr_sen_en_sen', 'pv_hr_sen_en', 'dp_hr_sen', 602000, '{"descriptorValueGUID": "dv13"}'::jsonb),
  ('pvd_hr_sen_en_lang', 'pv_hr_sen_en', 'dp_hr_lang', 603000, '{"descriptorValueGUID": "dv15"}'::jsonb),
  ('pvd_hr_sen_lv_sen', 'pv_hr_sen_lv', 'dp_hr_sen', 604000, '{"descriptorValueGUID": "dv13"}'::jsonb),
  ('pvd_hr_sen_lv_lang', 'pv_hr_sen_lv', 'dp_hr_lang', 605000, '{"descriptorValueGUID": "dv16"}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

-- rolePriceTable: 57 rows - Bill rate + Cost rate of every human, material and expense role (per its unit), the Senior, English bill rate of the human roles, and the Bill rate of each revenue stage
INSERT INTO public."rolePriceTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('rp_hr_pm_bill', 'hr_pm', 'empty', 33000, '{"priceTypeGUID": "pt_bill", "price": 62, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_hr_pm_cost', 'hr_pm', 'empty', 34000, '{"priceTypeGUID": "pt_cost", "price": 38, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_hr_pm_bill_sen_en', 'hr_pm', 'pv_hr_sen_en', 35000, '{"priceTypeGUID": "pt_bill", "price": 78, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_hr_ba_bill', 'hr_ba', 'empty', 36000, '{"priceTypeGUID": "pt_bill", "price": 52, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_hr_ba_cost', 'hr_ba', 'empty', 37000, '{"priceTypeGUID": "pt_cost", "price": 31, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_hr_ba_bill_sen_en', 'hr_ba', 'pv_hr_sen_en', 38000, '{"priceTypeGUID": "pt_bill", "price": 64, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_hr_da_bill', 'hr_da', 'empty', 39000, '{"priceTypeGUID": "pt_bill", "price": 48, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_hr_da_cost', 'hr_da', 'empty', 40000, '{"priceTypeGUID": "pt_cost", "price": 29, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_hr_da_bill_sen_en', 'hr_da', 'pv_hr_sen_en', 41000, '{"priceTypeGUID": "pt_bill", "price": 60, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_hr_fe_bill', 'hr_fe', 'empty', 42000, '{"priceTypeGUID": "pt_bill", "price": 52, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_hr_fe_cost', 'hr_fe', 'empty', 43000, '{"priceTypeGUID": "pt_cost", "price": 31, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_hr_fe_bill_sen_en', 'hr_fe', 'pv_hr_sen_en', 44000, '{"priceTypeGUID": "pt_bill", "price": 66, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_hr_be_bill', 'hr_be', 'empty', 45000, '{"priceTypeGUID": "pt_bill", "price": 56, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_hr_be_cost', 'hr_be', 'empty', 46000, '{"priceTypeGUID": "pt_cost", "price": 34, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_hr_be_bill_sen_en', 'hr_be', 'pv_hr_sen_en', 47000, '{"priceTypeGUID": "pt_bill", "price": 70, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_mat_wood_plate_20_bill', 'mat_wood_plate_20', 'empty', 48000, '{"priceTypeGUID": "pt_bill", "price": 3.9, "measureUnit": "unit_pcs", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_mat_wood_plate_20_cost', 'mat_wood_plate_20', 'empty', 49000, '{"priceTypeGUID": "pt_cost", "price": 2.4, "measureUnit": "unit_pcs", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_mat_birch_plate_20_bill', 'mat_birch_plate_20', 'empty', 50000, '{"priceTypeGUID": "pt_bill", "price": 4.8, "measureUnit": "unit_pcs", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_mat_birch_plate_20_cost', 'mat_birch_plate_20', 'empty', 51000, '{"priceTypeGUID": "pt_cost", "price": 3.1, "measureUnit": "unit_pcs", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_mat_oak_board_bill', 'mat_oak_board', 'empty', 52000, '{"priceTypeGUID": "pt_bill", "price": 27.0, "measureUnit": "unit_pcs", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_mat_oak_board_cost', 'mat_oak_board', 'empty', 53000, '{"priceTypeGUID": "pt_cost", "price": 18.5, "measureUnit": "unit_pcs", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_mat_plywood_sheet_bill', 'mat_plywood_sheet', 'empty', 54000, '{"priceTypeGUID": "pt_bill", "price": 46.5, "measureUnit": "unit_pcs", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_mat_plywood_sheet_cost', 'mat_plywood_sheet', 'empty', 55000, '{"priceTypeGUID": "pt_cost", "price": 32.0, "measureUnit": "unit_pcs", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_mat_steel_profile_bill', 'mat_steel_profile', 'empty', 56000, '{"priceTypeGUID": "pt_bill", "price": 6.5, "measureUnit": "unit_m", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_mat_steel_profile_cost', 'mat_steel_profile', 'empty', 57000, '{"priceTypeGUID": "pt_cost", "price": 4.2, "measureUnit": "unit_m", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_mat_alu_sheet_bill', 'mat_alu_sheet', 'empty', 58000, '{"priceTypeGUID": "pt_bill", "price": 32.0, "measureUnit": "unit_m2", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_mat_alu_sheet_cost', 'mat_alu_sheet', 'empty', 59000, '{"priceTypeGUID": "pt_cost", "price": 21.0, "measureUnit": "unit_m2", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_mat_copper_cable_bill', 'mat_copper_cable', 'empty', 60000, '{"priceTypeGUID": "pt_bill", "price": 2.2, "measureUnit": "unit_m", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_mat_copper_cable_cost', 'mat_copper_cable', 'empty', 61000, '{"priceTypeGUID": "pt_cost", "price": 1.35, "measureUnit": "unit_m", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_mat_wood_screws_bill', 'mat_wood_screws', 'empty', 62000, '{"priceTypeGUID": "pt_bill", "price": 10.5, "measureUnit": "unit_pcs", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_mat_wood_screws_cost', 'mat_wood_screws', 'empty', 63000, '{"priceTypeGUID": "pt_cost", "price": 6.8, "measureUnit": "unit_pcs", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_mat_varnish_bill', 'mat_varnish', 'empty', 64000, '{"priceTypeGUID": "pt_bill", "price": 14.9, "measureUnit": "unit_l", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_mat_varnish_cost', 'mat_varnish', 'empty', 65000, '{"priceTypeGUID": "pt_cost", "price": 9.5, "measureUnit": "unit_l", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_mat_epoxy_bill', 'mat_epoxy', 'empty', 66000, '{"priceTypeGUID": "pt_bill", "price": 18.9, "measureUnit": "unit_kg", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_mat_epoxy_cost', 'mat_epoxy', 'empty', 67000, '{"priceTypeGUID": "pt_cost", "price": 12.4, "measureUnit": "unit_kg", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_exp_warehouse_bill', 'exp_warehouse', 'empty', 68000, '{"priceTypeGUID": "pt_bill", "price": 19.5, "measureUnit": "unit_month", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_exp_warehouse_cost', 'exp_warehouse', 'empty', 69000, '{"priceTypeGUID": "pt_cost", "price": 14.0, "measureUnit": "unit_month", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_exp_pallet_handling_bill', 'exp_pallet_handling', 'empty', 70000, '{"priceTypeGUID": "pt_bill", "price": 5.9, "measureUnit": "unit_pcs", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_exp_pallet_handling_cost', 'exp_pallet_handling', 'empty', 71000, '{"priceTypeGUID": "pt_cost", "price": 3.8, "measureUnit": "unit_pcs", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_exp_customs_bill', 'exp_customs', 'empty', 72000, '{"priceTypeGUID": "pt_bill", "price": 52.0, "measureUnit": "unit_pcs", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_exp_customs_cost', 'exp_customs', 'empty', 73000, '{"priceTypeGUID": "pt_cost", "price": 35.0, "measureUnit": "unit_pcs", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_exp_van_bill', 'exp_van', 'empty', 74000, '{"priceTypeGUID": "pt_bill", "price": 1.3, "measureUnit": "unit_km", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_exp_van_cost', 'exp_van', 'empty', 75000, '{"priceTypeGUID": "pt_cost", "price": 0.85, "measureUnit": "unit_km", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_exp_truck_bill', 'exp_truck', 'empty', 76000, '{"priceTypeGUID": "pt_bill", "price": 1.85, "measureUnit": "unit_km", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_exp_truck_cost', 'exp_truck', 'empty', 77000, '{"priceTypeGUID": "pt_cost", "price": 1.25, "measureUnit": "unit_km", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_exp_courier_bill', 'exp_courier', 'empty', 78000, '{"priceTypeGUID": "pt_bill", "price": 9.9, "measureUnit": "unit_pcs", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_exp_courier_cost', 'exp_courier', 'empty', 79000, '{"priceTypeGUID": "pt_cost", "price": 6.9, "measureUnit": "unit_pcs", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_exp_social_bill', 'exp_social', 'empty', 80000, '{"priceTypeGUID": "pt_bill", "price": 58.0, "measureUnit": "unit_day", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_exp_social_cost', 'exp_social', 'empty', 81000, '{"priceTypeGUID": "pt_cost", "price": 40.0, "measureUnit": "unit_day", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_exp_billboard_bill', 'exp_billboard', 'empty', 82000, '{"priceTypeGUID": "pt_bill", "price": 890.0, "measureUnit": "unit_month", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_exp_billboard_cost', 'exp_billboard', 'empty', 83000, '{"priceTypeGUID": "pt_cost", "price": 650.0, "measureUnit": "unit_month", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_exp_maintenance_bill', 'exp_maintenance', 'empty', 84000, '{"priceTypeGUID": "pt_bill", "price": 55.0, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_exp_maintenance_cost', 'exp_maintenance', 'empty', 85000, '{"priceTypeGUID": "pt_cost", "price": 38.0, "measureUnit": "unit_hour", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_exp_cleaning_bill', 'exp_cleaning', 'empty', 86000, '{"priceTypeGUID": "pt_bill", "price": 1.4, "measureUnit": "unit_m2", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_exp_cleaning_cost', 'exp_cleaning', 'empty', 87000, '{"priceTypeGUID": "pt_cost", "price": 0.9, "measureUnit": "unit_m2", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_rev_stage_1_bill', 'rev_stage_1', 'empty', 88000, '{"priceTypeGUID": "pt_bill", "price": 12000.0, "measureUnit": "unit_pcs", "validFrom": "2026-10-01"}'::jsonb),
  ('rp_rev_stage_2_bill', 'rev_stage_2', 'empty', 89000, '{"priceTypeGUID": "pt_bill", "price": 18000.0, "measureUnit": "unit_pcs", "validFrom": "2026-10-01"}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

NOTIFY pgrst, 'reload schema';

-- Check:
--   SELECT t."rowJSON"->>'title' AS role_type, t."rowJSON"->>'managementGenus' AS genus, count(r.*) AS roles
--     FROM public."resourceRoleTypeTable" t LEFT JOIN public."resourceRoleTable" r ON r."rowOwnerGUID" = t."rowGUID" GROUP BY 1, 2 ORDER BY 1;
