// Payment plan - the SystemMetaData entry (one reusable redux entity + saga, Supabase Realtime). Spread into kit8/redux/SystemMetaData.ts: `...taskPaymentPlanSystemMetaData()`.
import { emptyPaymentPlanLine, TASK_PAYMENT_PLAN_ENTITY, taskPaymentPlanTable } from './paymentPlanModel';

export function taskPaymentPlanSystemMetaData(): Record<string, any> {
  return {
    [TASK_PAYMENT_PLAN_ENTITY]: {
      tableName: taskPaymentPlanTable,
      itemLabel: 'Payment',
      updateValidator: () => {},
      defaultData: emptyPaymentPlanLine(),
      prepareCreateApi: (p: any) => ({ newItem: p.action.payload }),
      prepareReadApi: (_p: any) => {},
    },
  };
}
