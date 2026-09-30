
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

