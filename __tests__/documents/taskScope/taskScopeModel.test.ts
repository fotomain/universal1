// taskScopeModel: the route params / links of the document lists filtered for a task or a task line, and the keys sent to the list RPCs (vendor_invoice_list, task_fact_document_list).
import {
  EMPTY_TASK_SCOPE, FACT_LIST_ROUTE, VENDOR_INVOICE_LIST_ROUTE, factListPath, parseTaskScope, sameTaskScope, taskScopeActive, taskScopeLabel, taskScopeRouteParams, taskScopeToRpc, vendorInvoiceListPath,
} from '../../../kit8/documents/taskScope/taskScopeModel';

describe('parseTaskScope', () => {
  it('reads taskGUID / taskLineGUID of the route params (an array = its first value); nothing = the empty scope', () => {
    expect(parseTaskScope({ taskGUID: 't1', taskLineGUID: 'l1' })).toEqual({ taskGUID: 't1', taskLineGUID: 'l1' });
    expect(parseTaskScope({ taskGUID: ['t1'] })).toEqual({ taskGUID: 't1', taskLineGUID: '' });
    expect(parseTaskScope({})).toBe(EMPTY_TASK_SCOPE);
    expect(parseTaskScope(undefined)).toBe(EMPTY_TASK_SCOPE);
    expect(parseTaskScope({ taskGUID: '  ' })).toBe(EMPTY_TASK_SCOPE);
  });
  it('a value that is not a short string is ignored', () => {
    expect(parseTaskScope({ taskGUID: 'x'.repeat(100) })).toBe(EMPTY_TASK_SCOPE);
    expect(parseTaskScope({ taskGUID: 5 as any })).toBe(EMPTY_TASK_SCOPE);
  });
});

describe('the scope', () => {
  it('active / same', () => {
    expect(taskScopeActive(EMPTY_TASK_SCOPE)).toBe(false);
    expect(taskScopeActive(null)).toBe(false);
    expect(taskScopeActive({ taskGUID: 't', taskLineGUID: '' })).toBe(true);
    expect(sameTaskScope({ taskGUID: 't', taskLineGUID: '' }, { taskGUID: 't', taskLineGUID: '' })).toBe(true);
    expect(sameTaskScope({ taskGUID: 't', taskLineGUID: '' }, { taskGUID: 't', taskLineGUID: 'l' })).toBe(false);
  });
  it('the RPC keys and the route params carry only what is set', () => {
    expect(taskScopeToRpc({ taskGUID: 't', taskLineGUID: '' })).toEqual({ taskGUID: 't' });
    expect(taskScopeToRpc({ taskGUID: 't', taskLineGUID: 'l' })).toEqual({ taskGUID: 't', taskLineGUID: 'l' });
    expect(taskScopeToRpc(EMPTY_TASK_SCOPE)).toEqual({});
    expect(taskScopeRouteParams({ taskGUID: 't', taskLineGUID: 'l' })).toEqual({ taskGUID: 't', taskLineGUID: 'l' });
  });
  it('the links of the two lists', () => {
    expect(vendorInvoiceListPath({ taskGUID: 't 1', taskLineGUID: '' })).toBe(`${VENDOR_INVOICE_LIST_ROUTE}?taskGUID=t%201`);
    expect(factListPath({ taskGUID: 't', taskLineGUID: 'l' })).toBe(`${FACT_LIST_ROUTE}?taskGUID=t&taskLineGUID=l`);
    expect(factListPath(EMPTY_TASK_SCOPE)).toBe(FACT_LIST_ROUTE);
    expect(VENDOR_INVOICE_LIST_ROUTE).toBe('/pm/vendor-invoice/list');
    expect(FACT_LIST_ROUTE).toBe('/pm/fact/list');
  });
  it('the chip text: the task name (or the start of its GUID), the line by the start of its GUID', () => {
    expect(taskScopeLabel({ taskGUID: 'abcdef123456', taskLineGUID: '' }, 'Task 111')).toBe('Task: Task 111');
    expect(taskScopeLabel({ taskGUID: 'abcdef123456', taskLineGUID: '' }, '')).toBe('Task: abcdef12');
    expect(taskScopeLabel({ taskGUID: 't', taskLineGUID: 'aaaaaaaa-0000' }, 'Task 111')).toBe('Task line aaaaaaaa · Task: Task 111');
  });
});
