#!/usr/bin/env python3
"""One-time edit of start2_sql_code.sql (SQL PART 47, E3): the document RPCs whose own rule is the organization / the state of the document (they have no project to ask about) get
`IF auth.uid() IS NOT NULL THEN PERFORM public.perm_require('<table>', '<letter>'); END IF;` as their first statement: the letters of the profiles the caller holds ANYWHERE (a read only
member cannot delete a draft invoice or change its header). Idempotent. Usage: python3 kit8/sql/permissions/guard_document_rpcs.py"""
import os, re
P = os.path.join(os.path.dirname(__file__), '..', 'start', 'start2_sql_code.sql')
MAP = {
    'customer_invoice_set_header': ('customer_invoice_header', 'U'), 'vendor_invoice_set_header': ('vendor_invoice_header', 'U'), 'purchase_order_set_header': ('purchase_order_header', 'U'),
    'product_receipt_set_header': ('product_receipt_header', 'U'), 'payment_fact_set_header': ('project_payment_fact_header', 'U'),
    'delete_customer_invoice': ('customer_invoice_header', 'D'), 'delete_vendor_invoice': ('vendor_invoice_header', 'D'), 'delete_purchase_order': ('purchase_order_header', 'D'),
    'delete_product_receipt': ('product_receipt_header', 'D'), 'delete_payment_fact': ('project_payment_fact_header', 'D'),
    'create_timesheet_from_task': ('project_timesheet_header', 'C'), 'timesheet_add_line': ('project_timesheet_header', 'U'), 'timesheet_set_header': ('project_timesheet_header', 'U'),
    'post_timesheet': ('project_timesheet_header', 'U'), 'unpost_timesheet': ('project_timesheet_header', 'U'),
    'pm_version_set_title': ('version_project_table', 'U'),
}
s = open(P, encoding='utf-8').read()
n = 0
for name, (tbl, op) in MAP.items():
    for m in list(re.finditer(r'CREATE OR REPLACE FUNCTION public\.%s\(' % name, s))[::-1]:
        b = s.index('\nBEGIN\n', m.start()) + len('\nBEGIN\n')
        end_of_fn = s.index('\n$$;', m.start())
        if b > end_of_fn: raise SystemExit('no BEGIN in ' + name)
        if "perm_require('%s'" % tbl in s[b:b + 200]: continue
        s = s[:b] + "  IF auth.uid() IS NOT NULL THEN PERFORM public.perm_require('%s', '%s'); END IF;   -- PART 47: the matrix (no project here: the letters of the profiles held anywhere)\n" % (tbl, op) + s[b:]
        n += 1
open(P, 'w', encoding='utf-8').write(s)
print('guarded', n, 'definitions')
