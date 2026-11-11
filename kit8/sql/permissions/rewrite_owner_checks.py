#!/usr/bin/env python3
"""One-time edit of start2_sql_code.sql (SQL PART 47): inside the bodies of the RPC / helper FUNCTIONS, `pm_owns_project(X)` (= "X is a project I own") becomes
`perm_can_in('<table>', '<letter>', X)` (= "I hold a profile that gives the letter for the table in project X"; false for a NULL project, like the old test). Policies are NOT touched
(they stay as the owner floor; PART 47 adds the matrix policies next to them). The map below is the review list: function -> (table of the matrix, letter).
Idempotent: a second run finds nothing to replace. Usage: python3 kit8/sql/permissions/rewrite_owner_checks.py [--dry]"""
import os, re, sys
P = os.path.join(os.path.dirname(__file__), '..', 'start', 'start2_sql_code.sql')
MAP = {
    'create_customer_invoices': ('customer_invoice_header', 'C'), 'customer_invoice_add_line': ('customer_invoice_header', 'U'), 'customer_invoice_candidates': ('customer_invoice_header', 'R'),
    'post_customer_invoice': ('customer_invoice_header', 'U'), 'unpost_customer_invoice': ('customer_invoice_header', 'U'),
    'create_vendor_invoices': ('vendor_invoice_header', 'C'), 'vendor_invoice_add_line': ('vendor_invoice_header', 'U'), 'vendor_invoice_candidates': ('vendor_invoice_header', 'R'),
    'vendor_invoice_set_line_task': ('vendor_invoice_header', 'U'), 'post_vendor_invoice': ('vendor_invoice_header', 'U'), 'unpost_vendor_invoice': ('vendor_invoice_header', 'U'),
    'create_vendor_invoice_from_receipt': ('vendor_invoice_header', 'C'),
    'create_purchase_orders': ('purchase_order_header', 'C'), 'purchase_order_add_line': ('purchase_order_header', 'U'), 'purchase_order_set_line_task': ('purchase_order_header', 'U'),
    'post_purchase_order': ('purchase_order_header', 'U'), 'unpost_purchase_order': ('purchase_order_header', 'U'),
    'create_product_receipt_from_order': ('product_receipt_header', 'C'), 'product_receipt_add_line': ('product_receipt_header', 'U'),
    'post_product_receipt': ('product_receipt_header', 'U'), 'unpost_product_receipt': ('product_receipt_header', 'U'),
    'payment_fact_create': ('project_payment_fact_header', 'C'), 'payment_fact_from_invoice': ('project_payment_fact_header', 'C'), 'payment_fact_add_from_plan': ('project_payment_fact_header', 'U'),
    'payment_fact_add_line': ('project_payment_fact_header', 'U'), 'payment_fact_set_line_task': ('project_payment_fact_header', 'U'), 'payment_fact_plan_candidates': ('project_payment_fact_header', 'R'),
    'post_payment_fact': ('project_payment_fact_header', 'U'), 'unpost_payment_fact': ('project_payment_fact_header', 'U'),
    'task_fact_document_create': ('task_fact_header', 'C'), 'post_task_fact_document': ('task_fact_header', 'U'), 'unpost_task_fact_document': ('task_fact_header', 'U'),
    'task_fact_header_state': ('task_fact_header', 'R'),
    'create_task_line_plan': ('task_line_table', 'U'),
    'post_task_payment_plan': ('task_payment_plan_lines', 'U'), 'unpost_task_payment_plan': ('task_payment_plan_lines', 'U'), 'task_payment_paid': ('task_payment_plan_lines', 'R'),
    'pm_kanban_ensure_project_stages': ('project_kanban_stage_table', 'C'), 'pm_recalc_project_progress': ('project_task_table', 'R'),
    'pm_version_save': ('version_project_table', 'C'), 'pm_version_restore': ('project_table', 'U'),
    'project_resource_leveling_inputs': ('project_resource_leveling_run', 'R'), 'project_resource_leveling_server_plan': ('project_resource_leveling_run', 'R'),
    'project_resource_leveling_apply': ('project_resource_leveling_run', 'C'), 'project_resource_leveling_clear': ('project_resource_leveling_run', 'U'), 'project_resource_leveling_undo': ('project_resource_leveling_run', 'U'),
    'monitor01_refresh_now': ('monitor01_view', 'R'), 'monitor01_stamp': ('monitor01_view', 'R'),
    'roi_rebuild': ('project_table', 'U'), 'roi_report_projects': ('project_table', 'R'), 'update_project_cost_total': ('project_table', 'U'),
    'task_template_fill': ('project_task_table', 'U'), 'task_template_save': ('project_task_table', 'R'),
}
# functions that keep the OWNER test on purpose (ownership: the helper itself, deleting / handing over a project)
KEEP = {'pm_owns_project', 'pm_owns_version'}

def main():
    dry = '--dry' in sys.argv
    s = open(P, encoding='utf-8').read()
    # positions of the starts of all CREATE statements we care about, to find the enclosing function of an occurrence
    starts = [(m.start(), m.group(1)) for m in re.finditer(r'CREATE OR REPLACE FUNCTION public\.(\w+)\(', s)]
    ends = [m.end() for m in re.finditer(r'\n\$\$;|\n\$[a-z_]*\$;', s)]
    out, last, n, unmapped, seen = [], 0, 0, {}, set()
    for m in re.finditer(r'public\.pm_owns_project\(', s):
        pos = m.start()
        enc = None
        for sp, name in starts:
            if sp < pos: enc = (sp, name)
            else: break
        # is the occurrence inside that function (no function end between the start and the occurrence)?
        inside = enc is not None and not any(enc[0] < e < pos for e in ends)
        if not inside: continue
        name = enc[1]
        if name in KEEP: continue
        if name not in MAP:
            unmapped[name] = unmapped.get(name, 0) + 1
            continue
        tbl, op = MAP[name]
        out.append(s[last:pos]); out.append("public.perm_can_in('%s', '%s', " % (tbl, op)); last = m.end(); n += 1; seen.add(name)
    out.append(s[last:])
    print('replaced', n, 'uses in', len(seen), 'functions; not in the map:', unmapped or 'none')
    missing = sorted(set(MAP) - seen)
    if missing: print('map entries with no use left (already rewritten or not present):', missing)
    if not dry and n: open(P, 'w', encoding='utf-8').write(''.join(out))

if __name__ == '__main__':
    main()
