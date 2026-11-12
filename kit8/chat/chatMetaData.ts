// Chat - the SystemMetaData entries (one reusable redux entity + saga + Supabase Realtime for each table). Spread into kit8/redux/SystemMetaData.ts: `...chatSystemMetaData()`.
// The tables are READ by the client (RLS: the rows of the themes the user belongs to) and written only by the chat_ RPCs, so the entities are used for reading and for the realtime listener.
import { CHAT_TABLES } from './chatModel';

export function chatSystemMetaData(): Record<string, any> {
  const out: Record<string, any> = {};
  for (const t of Object.values(CHAT_TABLES)) {
    out[t.entity] = {
      tableName: t.table,
      itemLabel: t.itemLabel,
      updateValidator: () => {},
      defaultData: {},
      prepareCreateApi: (p: any) => ({ newItem: p.action.payload }),
      prepareReadApi: (_p: any) => {},
    };
  }
  return out;
}
