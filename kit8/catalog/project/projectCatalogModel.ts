// Project catalog model for /catalog/project
// Reuses PMProjectRow and types from kit8/pm/model/types

import type { PMProjectRow } from '../../pm/model/types';
import type { CardItem } from '../../components/list/web/lib';
import { formatDateShort } from '../../pm/view/project/scheduling';

export const PROJECT_ENTITY = 'projectReusable';

export const PROJECT_CATALOG_ROUTES = {
  list: '/catalog/project',
  dashboard: '/pm/project/dashboard',
} as const;

/** Maps a PMProjectRow to CardItem for ListWebCardsComponent */
export function projectToCard(row: PMProjectRow, index = 0): CardItem {
  const json = row.rowJSON || {};
  const name = json.name || 'Untitled Project';
  const startStr = json.projectStartAt ? formatDateShort(Date.parse(json.projectStartAt)) : null;
  const finishStr = row.rowDuration ? formatDateShort(Date.parse(row.rowDuration)) : null;
  const dateRange = startStr && finishStr ? `${startStr} – ${finishStr}` : startStr || 'Dates not set';
  const progress = Math.round(row.rowProgress ?? 0);

  const parts = [
    `Progress: ${progress}%`,
    dateRange,
    json.skipWeekends ? 'Skip weekends' : null,
  ].filter(Boolean);

  return {
    id: row.rowGUID,
    title: name,
    description: parts.join(' · '),
    order: row.orderInList ?? index,
    rawItem: row,
  };
}
