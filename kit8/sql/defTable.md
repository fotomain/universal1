
# Defautl table strucrute description

    rowGUID: uuid,
    rowOwnerGUID: uuid,
    rowParentGUID: uuid,
    orderInList: float,
    rowJSON: blob,
    created_at timestamp,
    update_at timestamp,
    

# Tables that use this pattern

    project_user_settings_table (kit8/sql/init/create_pm_tables.sql, RN: projectUserSettingsTable)
        rowOwnerGUID  = project_table.rowGUID   (the project)
        rowParentGUID = the user (Supabase auth uid)
        rowJSON       = { uxuiSettings: {...} }  user specified data for visualisations

    currencyTable (kit8/sql/init/create_currency_table.sql, RN: currenciesTable = "currencyTable", kit8/catalog/currency)
        rowOwnerGUID  = 'currencyCatalog' (shared catalog), rowParentGUID = 'empty'
        rowJSON       = { currencyCode, currencyName, currencySymbol, currencyNumericCode, decimalDigits, isActive }
        realtime      = supabase_realtime publication -> redux-saga realtime (auto refresh in every browser)

    currencyExchangeRateTable (kit8/sql/init/create_currency_exchange_rate_table.sql,
                               RN: currencyExchangeRateTable = "currencyExchangeRateTable", kit8/catalog/currency/exchange)
        rowOwnerGUID  = currencyTable.rowGUID   (the currency)
        rowParentGUID = the day entered by the user, 'YYYY-MM-DD' -> 1 record per currency per day (unique index)
        orderInList   = -(days since 1970-01-01)  (ascending = newest day first)
        rowJSON       = { startingDate, currencyRatio }   startingDate = rowParentGUID, currencyRatio > 0
        realtime      = supabase_realtime publication -> redux-saga realtime scoped by readParams.match = { rowOwnerGUID }

    kanban_stage_table (kit8/sql/init/create_pm_kanban_tables.sql, RN: kanbanStageTable = "kanban_stage_table", kit8/pm/crud/kanban)
        rowOwnerGUID  = 'kanbanStageCatalog' (shared catalog), rowParentGUID = 'empty'
        orderInList   = default column order
        rowJSON       = { stageCode, stageName, stageColor, isActive }
                        seed = projectTaskKanbanStages: Waiting, Plan, Analyse, Construct, Execute
        realtime      = supabase_realtime publication -> React Query invalidation (kit8/pm/crud/realtime)

    project_kanban_stage_table (kit8/sql/init/create_pm_kanban_tables.sql, RN: projectKanbanStageTable = "project_kanban_stage_table")
        rowOwnerGUID  = project_table.rowGUID   (the project; deleted with it)
        rowParentGUID = kanban_stage_table.rowGUID it was copied from, or 'empty' (custom stage)
        orderInList   = column order (first column = default stage of every task)
        rowJSON       = { stageCode, stageName, stageColor, wipLimit }
        realtime      = scoped by rowOwnerGUID (the project); edited with Project settings -> "Kanban Stages"

    project_task_kanban_state_table (kit8/sql/init/create_pm_kanban_tables.sql, RN: projectTaskKanbanStateTable = "project_task_kanban_state_table")
        rowOwnerGUID  = project_table.rowGUID   (the project -> one realtime filter per project)
        rowParentGUID = project_task_table.rowGUID (the task; deleted with it), UNIQUE (rowOwnerGUID, rowParentGUID)
        orderInList   = card order inside its column
        rowJSON       = { stageGUID }  = project_kanban_stage_table.rowGUID
                        no row / unknown stage = the project's first stage; independent of the task progress %
        realtime      = scoped by rowOwnerGUID (the project)

    personTable (kit8/sql/init/create_person_table.sql, RN: personsTable = "personTable", kit8/catalog/person)
        rowOwnerGUID  = 'personCatalog' (shared catalog), rowParentGUID = 'empty'
        rowJSON       = { personFirstName, personLastName, personTitle, personEmail, personPhone, isActive, personIsEmployee, employeeData }
        realtime      = supabase_realtime publication -> redux-saga realtime (auto refresh)
        security      = Authenticated only (GDPR compliant)

    partnerTable (kit8/sql/init/create_partner_table.sql, RN: partnersTable = "partnerTable", kit8/catalog/partner)
        rowOwnerGUID  = 'partnerCatalog' (shared catalog), rowParentGUID = 'empty'
        rowJSON       = { partnerTitle, partnerLegalName, partnerKind, isActive, partnerIsSupplier, partnerIsCustomer, legalData, supplierData, customerData }
        realtime      = supabase_realtime publication -> redux-saga realtime (auto refresh)
        security      = Authenticated only

    contractTable (kit8/sql/init/create_contract_table.sql, RN: contractsTable = "contractTable", kit8/catalog/contract)
        rowOwnerGUID  = personTable.rowGUID or partnerTable.rowGUID (the person or partner)
        rowParentGUID = 'person' or 'partner' (matches contractPartyType)
        orderInList   = -(days since 1970-01-01) of contractStartDate (ascending = newest first)
        rowJSON       = { contractPartyType, contractNumber, contractTitle, contractType, contractStatus, contractSignedDate, contractStartDate, contractFinishDate, contractPaymentsPeriod, contractCurrency, contractSumBeforeVAT, contractVATRate, contractVAT, contractTotal, notes }
        realtime      = supabase_realtime publication -> redux-saga realtime scoped by rowOwnerGUID
        security      = Authenticated only (GDPR compliant)

    Product catalog (kit8/sql/init/create_product_tables.sql, kit8/catalog/product, screen /catalog/product/dashboard)
      Source: Google Sheet "W1 V3 ER DESCRIPTORS PLAN" (1C:ERP: product type -> product -> Properties + Variants on Descriptors).
      Product side only (no resource-role tables yet). TEXT rowGUIDs (sheet ids kept: smartphone1, dv1, dp1, pv1, prod1 ...).
      measureUnitForInventoryTable           owner 'measureUnitForInventoryCatalog'                       rowJSON { title, code }
      descriptorGenusTable       owner 'descriptorGenusCatalog'                   rowJSON { title, valueType ref|string|number|boolean|date, unit, allowedDescriptionModes[], targetKinds[], isActive }
      descriptorValueTable       owner = descriptorGenus                          rowJSON { code, title, hex, num, sort }
      descriptorModeTable        owner 'descriptorModeCatalog', rowGUID property|variant   rowJSON { title, createsVariant, sort }
      descriptorDestinationTable owner = productType, parent = descriptorMode     rowJSON { title }            (one set per type + mode)
      descriptorPlanTable        owner = descriptorDestination, parent = genus   rowJSON { required, sort, inVariantTitle, showInCard }
      productTypeTable           owner 'productTypeCatalog'                       rowJSON { title, baseUnit, propertySet, variantSet, variantMode none|perType|perProduct|sharedWithType, variantSharedTypeGUID, uniqueVariants, variantTitleTemplate, useSerialNumbers, usePackaging, useSeries, isActive }
      productFolderTable         owner 'productFolderCatalog', parent = parent folder | 'empty'   rowJSON { title }
      productTable               owner = productType, parent = productFolder     rowJSON { title, sku, unit, description, isActive }
      propertyValueTable         owner = product, parent = descriptorPlan        rowJSON { descriptorValueGUID } | { value }
      variantTable               owner = productType | product (variantMode)     rowJSON { title, descriptorKey, isActive }
      variantValueTable          owner = variant, parent = descriptorPlan        rowJSON { descriptorValueGUID }
      productPackagingTable      owner = productType | product, parent = unit   rowJSON { title, ratio }
      productSeriesTable         owner = productType                             rowJSON { number, serialNumber, producedAt, expiresAt }
      productBarcodeTable        owner = product, parent = variant | 'empty'     rowJSON { barcode, packagingGUID }
      priceTypeTable             owner 'priceTypeCatalog'                         rowJSON { title, currency, vatIncluded, appliesTo[] }
      productPriceTable          owner = product, parent = variant | 'empty'     rowJSON { priceTypeGUID, price, validFrom }
      realtime = supabase_realtime publication -> redux-saga realtime (ReusableTable all-rows mode, one channel per table)
      security = Authenticated only

# Project versions (kit8/pm/version, documentation/PM_VERSION_STRUCTURE.html)

    Table name = 'version_' + original table name. Every version table has rowVersionGUID (one value per saved
    version); the rows keep the ORIGINAL rowGUID, so rows of two versions and of the live project match by rowGUID.
    Written only by the RPCs pm_version_save / pm_version_restore / pm_version_set_title; clients: SELECT + DELETE.

    version_project_table (kit8/sql/init/done/create_tables.sql 5b, RN: versionProjectTable = "version_project_table")
        rowVersionGUID = the version (primary key)
        rowGUID        = project_table.rowGUID (the project; its versions are deleted with it)
        rowOwnerGUID   = the user (Supabase auth uid)
        orderInList    = version number inside the project (1, 2, 3 ...)
        rowJSON        = project rowJSON + { versionTitle, versionCreatedAt, versionNumber, versionTaskCount }

    version_project_task_table / version_project_task_dependencies_table /
    version_project_kanban_stage_table / version_project_task_kanban_state_table
        rowVersionGUID = version_project_table.rowVersionGUID (deleted with it), then the original columns unchanged

# User calendar (kit8/register/user_calendar, kit8/sql/init/create_user_calendar_tables.sql)

    user_calendar_table (RN: userCalendarTable = "user_calendar_table")
        rowOwnerGUID  = the user (userState.userGUID), rowParentGUID = 'empty'
        rowJSON       = { calendarCode: 'my'|'tasks'|'birthdays'|'projectTasks', calendarTitle, calendarColor, isVisible }

    user_calendar_event_table (RN: userCalendarEventTable = "user_calendar_event_table")
        rowOwnerGUID  = the user, rowParentGUID = user_calendar_table.rowGUID or 'empty'
        orderInList   = start in ms since 1970
        rowJSON       = { kind: 'event'|'task'|'birthday'|'projectTask', title, allDay, startAt, endAt, startDate, endDate,
                          recurrence, exDates, notifications, guests, location, description, color, done, deadline,
                          googleEventId, intent, projectGUID, projectTaskGUID, projectTitle }
        kind 'projectTask' rows are written by the trigger on project_task_table (one per task / milestone)
        realtime      = scoped by rowOwnerGUID -> React Query invalidation

    user_calendar_invitation_table (RN: userCalendarInvitationTable = "user_calendar_invitation_table")
        rowOwnerGUID  = the user who invited, rowParentGUID = user_calendar_event_table.rowGUID
        rowJSON       = { email, status: 'sent'|'failed', sentAt, error, resendId }
