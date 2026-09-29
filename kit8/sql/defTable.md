
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
