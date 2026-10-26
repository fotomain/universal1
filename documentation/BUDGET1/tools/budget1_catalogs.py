"""
BUDGET1: the catalogs the WBS needs - business units, role types, roles (with hourly rates), budget items, measure units.
Everything has a FIXED code (b1_..., bgt...) so the script can be run again (ON CONFLICT DO UPDATE) and the rows are easy to find.
All money is in RUB (real rubles; the book counts in thousand rubles: 1 000 RUB = 1 "тыс. руб." of the book).
"""

# ------------------------------------------------------------------ business units (the organisation of the book: chapter 4, 6.2, 8.2); cfr = the responsibility centre type
# (code, parent, title, cfr or None = inherits)
BUSINESS_UNITS = [
    ('bu_b1_root', 'empty', 'Промышленное предприятие (организационная структура по книге Щиборщ К.В.)', 'investmentCenter'),
    ('bu_b1_board', 'bu_b1_root', 'Правление и высшее руководство', 'costCenter'),
    ('bu_b1_apparat', 'bu_b1_root', 'Аппарат управления (субъекты планирования)', 'costCenter'),
    ('bu_b1_pao', 'bu_b1_apparat', 'Планово-аналитический отдел (ПАО)', None),
    ('bu_b1_peu', 'bu_b1_apparat', 'Планово-экономическое управление (ПЭУ)', None),
    ('bu_b1_feu', 'bu_b1_apparat', 'Финансово-экономическое управление (ФЭУ)', None),
    ('bu_b1_ums', 'bu_b1_apparat', 'Управление маркетинга и сбыта (УМС)', None),
    ('bu_b1_uks', 'bu_b1_apparat', 'Управление капитального строительства (УКС)', None),
    ('bu_b1_otiz', 'bu_b1_apparat', 'Отдел труда и заработной платы (ОТиЗ)', None),
    ('bu_b1_accounting', 'bu_b1_apparat', 'Бухгалтерия', None),
    ('bu_b1_it', 'bu_b1_apparat', 'Служба информационных технологий', None),
    ('bu_b1_admin', 'bu_b1_root', 'Административные службы (центр управленческих затрат)', 'costCenter'),
    ('bu_b1_production', 'bu_b1_root', 'Производственные подразделения (центры нормативных затрат)', 'costCenter'),
    ('bu_b1_forge', 'bu_b1_production', 'Кузнечный цех', None),
    ('bu_b1_foundry', 'bu_b1_production', 'Литейный цех', None),
    ('bu_b1_mech', 'bu_b1_production', 'Механический цех', None),
    ('bu_b1_aux', 'bu_b1_production', 'Вспомогательные производства (энергетическая служба)', None),
    ('bu_b1_supply', 'bu_b1_root', 'Служба снабжения (специфический центр нормативных затрат)', 'costCenter'),
    ('bu_b1_warehouse', 'bu_b1_root', 'Складские службы', 'costCenter'),
    ('bu_b1_transport', 'bu_b1_root', 'Транспортный цех (обособленное подразделение)', 'costCenter'),
    ('bu_b1_sales', 'bu_b1_root', 'Отдел сбыта (центр доходов)', 'revenueCenter'),
    ('bu_b1_profit', 'bu_b1_root', 'Бизнес-единицы (центры прибыли)', 'profitCenter'),
]

# ------------------------------------------------------------------ role types (resourceRoleTypeTable) -> genus
# (code, title, managementGenus, baseUnit, description)
ROLE_TYPES = [
    ('bgtManagementRoles', 'Руководство компании (бюджетный процесс)', 'timeGenus', 'unit_hour', 'Президент, вице-президенты, Правление: утверждение и контроль бюджета'),
    ('bgtPlanningRoles', 'Планово-аналитические и финансовые службы', 'timeGenus', 'unit_hour', 'ПАО, ПЭУ, ФЭУ, УМС, УКС, ОТиЗ: субъекты планирования'),
    ('bgtAccountingRoles', 'Бухгалтерия и налоговый учет', 'timeGenus', 'unit_hour', 'Комплексный нормативный учет (стандарт-директ-костинг)'),
    ('bgtOperationalRoles', 'Подразделения: производство, снабжение, сбыт, склад', 'timeGenus', 'unit_hour', 'Объекты планирования (центры ответственности)'),
    ('bgtITRoles', 'Информационные технологии бюджетирования', 'timeGenus', 'unit_hour', 'Внедрение и сопровождение интегрированной системы управления (ИСУ)'),
    ('bgtMaterialRoles', 'Материальные оборотные ресурсы (МОР) и оборудование', 'materialGenus', 'unit_kg', 'Сырье, материалы, комплектующие, оборудование'),
    ('bgtExpenseRoles', 'Расходы: ОПР, коммерческие, административные, налоги', 'expenseGenus', 'unit_pcs', 'Статьи расходов бюджета (смета = 1 шт.)'),
    ('bgtRevenueRoles', 'Продукция и выручка', 'revenueGenus', 'unit_ton', 'Виды готовой продукции, реализуемой предприятием'),
]

# ------------------------------------------------------------------ roles: code -> (type, title, rate RUB per unit, default business unit)
# hourly rates are ILLUSTRATIVE (the book gives one: 2,05 thousand RUB per hour of the main production worker)
ROLES = {
    # management
    'r_president':        ('bgtManagementRoles', 'Президент компании', 6000, 'bu_b1_board'),
    'r_vp_economy':       ('bgtManagementRoles', 'Первый вице-президент по экономике', 5000, 'bu_b1_board'),
    'r_vp_production':    ('bgtManagementRoles', 'Первый вице-президент по производству (исполнительный директор)', 4500, 'bu_b1_board'),
    'r_commercial_dir':   ('bgtManagementRoles', 'Коммерческий директор (вице-президент по сбыту)', 4500, 'bu_b1_board'),
    'r_financial_dir':    ('bgtManagementRoles', 'Финансовый директор (вице-президент по финансам)', 4500, 'bu_b1_board'),
    'r_vp_investments':   ('bgtManagementRoles', 'Вице-президент по инвестициям', 4500, 'bu_b1_board'),
    'r_chief_engineer':   ('bgtManagementRoles', 'Главный инженер', 4000, 'bu_b1_production'),
    # planning and finance
    'r_head_pao':         ('bgtPlanningRoles', 'Начальник планово-аналитического отдела', 3500, 'bu_b1_pao'),
    'r_analyst':          ('bgtPlanningRoles', 'Экономист-аналитик (ПАО)', 2600, 'bu_b1_pao'),
    'r_head_peu':         ('bgtPlanningRoles', 'Начальник планово-экономического управления', 3500, 'bu_b1_peu'),
    'r_planner':          ('bgtPlanningRoles', 'Экономист-плановик (ПЭУ)', 2600, 'bu_b1_peu'),
    'r_head_feu':         ('bgtPlanningRoles', 'Начальник финансово-экономического управления', 3500, 'bu_b1_feu'),
    'r_fin_economist':    ('bgtPlanningRoles', 'Финансовый экономист (ФЭУ)', 2800, 'bu_b1_feu'),
    'r_head_ums':         ('bgtPlanningRoles', 'Начальник управления маркетинга и сбыта', 3500, 'bu_b1_ums'),
    'r_marketer':         ('bgtPlanningRoles', 'Маркетолог (УМС)', 2400, 'bu_b1_ums'),
    'r_head_uks':         ('bgtPlanningRoles', 'Начальник УКС', 3500, 'bu_b1_uks'),
    'r_uks_engineer':     ('bgtPlanningRoles', 'Инженер-сметчик УКС', 2500, 'bu_b1_uks'),
    'r_head_otiz':        ('bgtPlanningRoles', 'Начальник ОТиЗ', 3000, 'bu_b1_otiz'),
    'r_rate_setter':      ('bgtPlanningRoles', 'Нормировщик ОТиЗ', 2200, 'bu_b1_otiz'),
    # accounting
    'r_chief_accountant': ('bgtAccountingRoles', 'Главный бухгалтер', 3800, 'bu_b1_accounting'),
    'r_cost_accountant':  ('bgtAccountingRoles', 'Бухгалтер-калькулятор (учет затрат)', 2500, 'bu_b1_accounting'),
    'r_acc_materials':    ('bgtAccountingRoles', 'Бухгалтер по учету МОР и склада', 2300, 'bu_b1_accounting'),
    'r_acc_settlements':  ('bgtAccountingRoles', 'Бухгалтер по расчетам (покупатели, поставщики)', 2300, 'bu_b1_accounting'),
    'r_tax_accountant':   ('bgtAccountingRoles', 'Бухгалтер по налогам', 2600, 'bu_b1_accounting'),
    # operations
    'r_workshop_head':    ('bgtOperationalRoles', 'Начальник цеха', 3000, 'bu_b1_production'),
    'r_prod_worker':      ('bgtOperationalRoles', 'Основной производственный рабочий', 2050, 'bu_b1_production'),
    'r_aux_worker':       ('bgtOperationalRoles', 'Вспомогательный рабочий / обслуживающий персонал', 2000, 'bu_b1_aux'),
    'r_dispatcher':       ('bgtOperationalRoles', 'Диспетчер производства', 2300, 'bu_b1_production'),
    'r_supply_manager':   ('bgtOperationalRoles', 'Менеджер по снабжению', 2400, 'bu_b1_supply'),
    'r_sales_manager':    ('bgtOperationalRoles', 'Менеджер по сбыту', 2400, 'bu_b1_ums'),
    'r_warehouse_keeper': ('bgtOperationalRoles', 'Кладовщик', 1800, 'bu_b1_warehouse'),
    'r_warehouse_ctrl':   ('bgtOperationalRoles', 'Складской контролер', 2000, 'bu_b1_warehouse'),
    'r_transport_head':   ('bgtOperationalRoles', 'Начальник транспортного цеха', 2800, 'bu_b1_transport'),
    'r_unit_head':        ('bgtOperationalRoles', 'Руководитель бизнес-единицы (центра ответственности)', 3500, 'bu_b1_profit'),
    # IT
    'r_it_manager':       ('bgtITRoles', 'Руководитель проекта внедрения ИСУ', 4000, 'bu_b1_it'),
    'r_it_analyst':       ('bgtITRoles', 'Системный аналитик', 3200, 'bu_b1_it'),
    'r_it_programmer':    ('bgtITRoles', 'Программист / администратор ИСУ', 2800, 'bu_b1_it'),
    # materials (rate = price of one unit, RUB)
    'm_mat_111':          ('bgtMaterialRoles', 'Основной материал 111', 1000, 'bu_b1_supply'),
    'm_mat_112':          ('bgtMaterialRoles', 'Основной материал 112', 2200, 'bu_b1_supply'),
    'm_aux':              ('bgtMaterialRoles', 'Вспомогательные материалы (ОПР)', 1, 'bu_b1_production'),
    'm_packing':          ('bgtMaterialRoles', 'Вспомогательные материалы для упаковки', 1, 'bu_b1_ums'),
    'm_equipment':        ('bgtMaterialRoles', 'Оборудование к установке (капитальные вложения)', 1, 'bu_b1_uks'),
    # expenses (1 pcs = the whole estimate line)
    'e_energy':           ('bgtExpenseRoles', 'Энергия на производственные цели', 1, 'bu_b1_production'),
    'e_repair':           ('bgtExpenseRoles', 'Обслуживание и ремонт оборудования', 1, 'bu_b1_production'),
    'e_depreciation':     ('bgtExpenseRoles', 'Амортизация', 1, 'bu_b1_production'),
    'e_cleaning':         ('bgtExpenseRoles', 'Уборка производственных помещений', 1, 'bu_b1_production'),
    'e_insurance':        ('bgtExpenseRoles', 'Страхование имущества', 1, 'bu_b1_admin'),
    'e_security':         ('bgtExpenseRoles', 'Служба безопасности (охрана)', 1, 'bu_b1_admin'),
    'e_utilities':        ('bgtExpenseRoles', 'Коммунальные платежи', 1, 'bu_b1_admin'),
    'e_market_research':  ('bgtExpenseRoles', 'Маркетинговые исследования рынка', 1, 'bu_b1_ums'),
    'e_advertising':      ('bgtExpenseRoles', 'Реклама', 1, 'bu_b1_ums'),
    'e_commission':       ('bgtExpenseRoles', 'Комиссионные агентам и брокерам', 1, 'bu_b1_ums'),
    'e_transport':        ('bgtExpenseRoles', 'Транспортные расходы', 1, 'bu_b1_transport'),
    'e_other_commercial': ('bgtExpenseRoles', 'Прочие общие коммерческие расходы', 1, 'bu_b1_ums'),
    'e_taxes_in_cost':    ('bgtExpenseRoles', 'Налоги, включаемые в себестоимость', 1, 'bu_b1_admin'),
    'e_construction':     ('bgtExpenseRoles', 'Строительно-монтажные работы', 1, 'bu_b1_uks'),
    'e_contractor':       ('bgtExpenseRoles', 'Строительство подрядным способом', 1, 'bu_b1_uks'),
    'e_software':         ('bgtExpenseRoles', 'Программное обеспечение и услуги внедрения (ИСУ)', 1, 'bu_b1_it'),
    'e_audit':            ('bgtExpenseRoles', 'Аудит, консультации, обучение', 1, 'bu_b1_pao'),
    # revenue
    'p_prod_a':           ('bgtRevenueRoles', 'Продукт А (тонны)', 105400, 'bu_b1_sales'),
    'p_prod_b':           ('bgtRevenueRoles', 'Продукт Б (тонны)', 164000, 'bu_b1_sales'),
}

# ------------------------------------------------------------------ budget items: the STANDARD ones are in start4 (PART 32); the book's own items are added here
# (code, title, genus, key, direction, ifrs)
NEW_BUDGET_ITEMS = [
    ('b1CommissionBudgetItem', 'Комиссионные агентам и брокерам (прямые коммерческие расходы)', 'expenseGenus', 'operatingActivity.expenseGenus', 'outbound', '7.14(c) payments to suppliers for services'),
    ('b1AdvertisingBudgetItem', 'Реклама (прямая и общая)', 'expenseGenus', 'operatingActivity.expenseGenus', 'outbound', '7.14(c) payments to suppliers for services'),
    ('b1TransportBudgetItem', 'Транспортные расходы', 'expenseGenus', 'operatingActivity.expenseGenus', 'outbound', '7.14(c) payments to suppliers for services'),
    ('b1DepreciationBudgetItem', 'Амортизация (неденежная статья себестоимости)', 'expenseGenus', 'operatingActivity.expenseGenus', 'outbound', 'No cash flow of its own: allocation of the cost of PP&E'),
    ('b1TaxesInCostBudgetItem', 'Налоги, включаемые в себестоимость (имущество, автодороги, прочие)', 'expenseGenus', 'operatingActivity.expenseGenus', 'outbound', '7.14(f) income taxes / other taxes paid'),
    ('b1OtherCommercialBudgetItem', 'Прочие общие коммерческие расходы', 'expenseGenus', 'operatingActivity.expenseGenus', 'outbound', '7.14(c) payments to suppliers for services'),
]
# the standard items used (from start4): wages, materials, services, revenue and the investing ones
ITEM_WAGES = 'employeeWagesBudgetItem'
ITEM_RAW = 'rawMaterialsBudgetItem'
ITEM_CONSUMABLES = 'consumablesBudgetItem'
ITEM_SERVICES = 'subcontractedServicesBudgetItem'
ITEM_UTILITIES = 'utilitiesRentInsuranceBudgetItem'
ITEM_SALE = 'saleOfGoodsBudgetItem'
ITEM_PPE = 'purchaseOfPpeBudgetItem'
ITEM_CAPEX_COSTS = 'capitalisedCostsBudgetItem'
ITEM_EXTERNAL_LABOR = 'externalLaborBudgetItem'
ITEM_INTANGIBLES = 'purchaseOfIntangiblesBudgetItem'
STANDARD_ITEMS = [ITEM_WAGES, ITEM_RAW, ITEM_CONSUMABLES, ITEM_SERVICES, ITEM_UTILITIES, ITEM_SALE, ITEM_PPE, ITEM_CAPEX_COSTS, ITEM_EXTERNAL_LABOR, ITEM_INTANGIBLES]

# the default budget item of a role (the line may override)
ROLE_ITEM = {
    'e_energy': ITEM_UTILITIES, 'e_repair': ITEM_SERVICES, 'e_depreciation': 'b1DepreciationBudgetItem', 'e_cleaning': ITEM_SERVICES, 'e_insurance': ITEM_UTILITIES,
    'e_security': ITEM_SERVICES, 'e_utilities': ITEM_UTILITIES, 'e_market_research': ITEM_SERVICES, 'e_advertising': 'b1AdvertisingBudgetItem', 'e_commission': 'b1CommissionBudgetItem',
    'e_transport': 'b1TransportBudgetItem', 'e_other_commercial': 'b1OtherCommercialBudgetItem', 'e_taxes_in_cost': 'b1TaxesInCostBudgetItem',
    'e_construction': ITEM_CAPEX_COSTS, 'e_contractor': ITEM_CAPEX_COSTS, 'e_software': ITEM_INTANGIBLES, 'e_audit': ITEM_SERVICES,
    'm_mat_111': ITEM_RAW, 'm_mat_112': ITEM_RAW, 'm_aux': ITEM_CONSUMABLES, 'm_packing': ITEM_CONSUMABLES, 'm_equipment': ITEM_PPE,
    'p_prod_a': ITEM_SALE, 'p_prod_b': ITEM_SALE,
}

# ------------------------------------------------------------------ measure units (the standard ones: unit_pcs, unit_kg, unit_hour)
UNITS = [
    ('unit_ton', 'т', '168'),
    ('unit_doc', 'документ', '—'),
]
