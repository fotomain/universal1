# The permission matrices as DATA (documentation/PERMISSIONS_WBS.html, sections 5 and 6). The CRUD matrix is the owner's Google Sheet
# 1erjTWI6-q497G5XeHqz-R8Sks4vafEiB5Q1sUdawCU8 (tab Sheet1) as read on 2026-11-02; when the owner edits the sheet, change the groups / specials below and run
# build_permission_seed.py (it writes the seed blocks of start4 / start5 PART 46). Letters: C R U D, N = no access, own = own rows only (the existing row level rule).
PROFILES = [
    # code, level, title, description
    ('permissionOrganizationAdmin', 'organization', 'Organization administrator', 'R on the project tables of the organization; CRUD on generic tables, catalogs, users, members and permissions'),
    ('permissionProjectManager', 'project', 'Project manager', 'full CRUD on the data of the project; RC on the catalogs; given at the organization level: may create projects'),
    ('permissionProjectReadOnly', 'project', 'Project read only', 'R on all'),
    ('permissionProjectSponsor', 'project', 'Project sponsor', 'R on all'),
    ('permissionProjectCurator', 'project', 'Project curator', 'R on all; given at the organization level: may create projects'),
    ('permissionProjectInvestor', 'project', 'Project investor', 'R on all'),
    ('permissionProjectMember', 'project', 'Project member', 'derived: a person on a Time line as Accountable, Consulted or Informed reads the project'),
    ('permissionTaskResponsible', 'task', 'Task responsible', 'derived from RACI: the progress, the time sheet and the fact input of the task'),
    ('permissionTaskManager', 'task', 'Task manager', 'all task data except six disabled actions; how a person gets it is not decided yet'),
    ('permissionFinancialManagerPlan', 'project', 'Financial manager (plan)', 'CRUD on the money plans: task lines and the payment plan'),
    ('permissionFinancialManagerFact', 'project', 'Financial manager (fact)', 'CRUD on the money fact documents'),
]
CODES = [p[0] for p in PROFILES]

def row(*v):
    assert len(v) == 11, v
    return list(v)

R9 = ['R'] * 9
G = {
    'catalog':      row('CRUD', 'RC', *R9),                      # catalogs / generics
    'catalogR':     row('CRUD', 'R', *R9),                       # seeded fixed catalogs, organization
    'own':          row(*['own'] * 11),
    'register':     row(*['R'] * 11),                            # written by posting and workers only
    'doc':          row('R', 'CRUD', 'R', 'R', 'R', 'R', 'R', 'R', 'R', 'R', 'CRUD'),            # money fact documents
    'factdoc':      row('R', 'CRUD', 'R', 'R', 'R', 'R', 'R', 'CRUD', 'CRUD', 'R', 'CRUD'),     # fact input, time sheet
    'project':      row('R', 'CRUD', *R9),                       # project structure, templates, versions, leveling history
    'permission':   row('CRUD', 'R', *R9),                       # permission catalogs, texts
}
TABLES = {
    'catalog': """budgetItemTable budgetScenarioTable businessUnitTable cfrTypeTable contractTable countryTable currencyExchangeRateTable currencyTable descriptorDestinationTable
descriptorGenusTable descriptorModeTable descriptorPlanTable descriptorValueTable distributionGenericTable dtcCatalogExecutiveTable dtcFreeExecutiveTable dtcTaskFinishedTable
dtcTaskProgressTable dtcTaskRegisteredTable dtcTaskWaitingTable equipmentTable equipmentTypeTable kanban_stage_table legalEntityTable managementCalendarDaysTable managementCalendarTable
measureUnitTable moneyAccountTable partnerTable personTable personTypeTable priceTypeTable productBarcodeTable productFolderTable productPackageTable productPriceTable productSeriesTable
productTable productTypeTable propertyValueTable raciMemberTable resourceRoleFolderTable resourceRoleTable resourceRoleTypeTable rolePriceTable
templateResourceContractTable valueAddedTaxTable variantTable variantValueTable workCenterTable""",
    'catalogR': 'budgetItemGenericKeyTable managementActivityGenusTable managementGenusTable organizationTable',
    'own': """aiSessionTable app_route_visits_turnover googleDriveCommandTable mediaPostTable mediaPostTableArchive project_report_settings project_user_settings_table
templates_project_user_settings_table themeStoreTable userAuthTable user_calendar_event_table user_calendar_invitation_table user_calendar_table""",
    'register': """cash_account_ledger_dirty cash_account_ledger_movements cash_account_ledger_rests monitor01_refresh_log monitor01_view partner_balance_ledger partner_balance_movements
project_status_month_totals project_status_month_turnover project_status_movements project_status_roi_history project_status_roi_task_month project_task_cost_total
task_line_plan_movements task_line_plan_timeline task_payment_plan_movements managementRACIGenusTable""",
    'doc': """customer_invoice_header customer_invoice_lines product_receipt_header product_receipt_lines project_payment_fact_header project_payment_fact_lines
purchase_order_header purchase_order_lines vendor_invoice_header vendor_invoice_lines""",
    'factdoc': 'project_timesheet_header project_timesheet_lines project_timesheet_lines_data_entered task_fact_header task_fact_usage_timeline',
    'project': """project_kanban_stage_table project_resource_leveling_run project_resource_leveling_task project_subproject_link project_task_dependencies_table
project_task_dependency_closure_table task_template_dependency task_template_header task_template_line task_template_task templates_project_kanban_stage_table templates_project_table
templates_project_task_dependencies_table templates_project_task_dependency_closure_table templates_project_task_table version_project_kanban_stage_table version_project_table
version_project_task_dependencies_table version_project_task_kanban_state_table version_project_task_table""",
    'permission': """project_permission_profile_catalog project_permission_profile_crud_table project_permission_profile_uxui_table organizationTextTable""",
}
SPECIAL = {
    'organizationInvitationTable': row('CRUD', *['N'] * 10),
    'project_table': row('RC', 'CRUD', 'R', 'R', 'RC', 'R', 'R', 'R', 'R', 'R', 'R'),
    'project_task_kanban_state_table': row('R', 'CRUD', 'R', 'R', 'R', 'R', 'R', 'RU', 'RU', 'R', 'R'),
    'project_task_table': row('R', 'CRUD', 'R', 'R', 'R', 'R', 'R', 'RU', 'RU', 'R', 'R'),
    'task_line_table': row('R', 'CRUD', 'R', 'R', 'R', 'R', 'R', 'R', 'CRUD', 'CRUD', 'R'),
    'task_payment_plan_lines': row('R', 'CRUD', 'R', 'R', 'R', 'R', 'R', 'R', 'CRUD', 'CRUD', 'R'),
    'userTable': row('CRUD', *['own'] * 10),
    'organizationMemberTable': row('CRUD', 'R', *['N'] * 9),
    'project_permission_profile_user_table': row('CRUD', 'CRUD', *['N'] * 9),
    'task_user_permission_table': row('R', 'R', *['N'] * 9),
}
# keys of a CRUD row next to permissionSet: permissionWritableFields = ONLY these columns / rowJSON keys may change; permissionLockedFields = these may NOT change;
# permissionLockedActions = named actions refused by a trigger. A user's profiles ADD UP: a field is writable if any profile that gives U allows it.
TASK_LOCKED = ['taskDescription', 'rowKind', 'isMilestone', 'taskMarkAsMilestone', 'durationDays', 'manualStartAt', 'taskManualStartAt', 'taskConstraintType', 'taskConstraintDate',
               'taskDeadline', 'startAt', 'rowDuration', 'treePath', 'orderInList', 'taskScheduleMode', 'taskSplits', 'durationElapsed', 'durationEstimated']
EXTRA = {
    ('permissionTaskResponsible', 'project_task_table'): {'permissionWritableFields': ['rowProgress']},
    ('permissionTaskManager', 'project_task_table'): {'permissionLockedFields': TASK_LOCKED, 'permissionLockedActions': ['deleteSelfFromResponsible', 'changeTaskName', 'changeDependencies', 'taskToMilestone', 'changeDates', 'changePositionInTree']},
    ('permissionTaskManager', 'task_line_table'): {'permissionLockedActions': ['deleteSelfFromResponsible']},
    ('permissionTaskResponsible', 'project_task_kanban_state_table'): {'permissionWritableFields': ['rowJSON']},
    ('permissionFinancialManagerPlan', 'task_line_table'): {'permissionLockedFields': ['raciItem', 'taskResourceItem', 'taskResourceKind', 'taskWorkCenterKind']},
}

def crud_rows():
    out = {}
    for g, names in TABLES.items():
        for t in names.split():
            assert t not in out, t
            out[t] = G[g]
    for t, v in SPECIAL.items():
        assert t not in out, t
        out[t] = v
    return out

# Interface permissions (section 6.2). Columns: Admin, ProjectManager, read only group (RO, Sponsor, Curator, Investor, Member), TaskResponsible, TaskManager, FinPlan, FinFact
UX = [
    ('permissionTaskTimeTab permissionTaskMaterialTab permissionTaskExpenceTab permissionTaskDeliverableTab permissionTaskOutboundPaymentTab permissionTaskInboundPaymentTab permissionTaskPaymentPlan',
     ('R', 'CRUD', 'R', 'R', 'CRUD', 'CRUD', 'R')),
    ('permissionPurchaseOrder permissionProductReceipt permissionVendorInvoice permissionCustomerInvoice permissionPaymentFact permissionCustomerOrder permissionPackingSlip',
     ('R', 'CRUD', 'R', 'R', 'R', 'R', 'CRUD')),
    ('permissionFactInput permissionTimesheet', ('R', 'CRUD', 'R', 'CRUD', 'CRUD', 'R', 'CRUD')),
    ('permissionProgressPercent', ('R', 'RU', 'R', 'RU', 'RU', 'R', 'R')),
    ('permissionReportMonitor01 permissionReportMonitor02 permissionReportMonitor03 permissionReportMonitor07', ('R', 'R', 'R', 'R', 'R', 'R', 'R')),
    ('permissionOrganizationMembers', ('CRUD', 'R', 'N', 'N', 'N', 'N', 'N')),
    ('permissionProjectMembers', ('CRUD', 'CRUD', 'N', 'N', 'N', 'N', 'N')),
    ('permissionMatrixEditor permissionEditTexts', ('CRUD', 'N', 'N', 'N', 'N', 'N', 'N')),
]

def ux_rows():
    out = {}
    for names, (a, pm, ro, resp, tm, fp, ff) in UX:
        for o in names.split():
            out[o] = [a, pm, ro, ro, ro, ro, ro, resp, tm, fp, ff]
    return out
