// kit8/pm/view/tree/filter - Filter & sort of the task tree columns.
//   treeColumnFilter.ts        pure: filterVariantForColumn, parsing, D365 "matches", visible rows (filter + sort)
//   treeFilterIconGeometry.ts  pure: where the header icon sits / hit-testing
//   PMTreeColumnFilterPopup    the "Filter & sort" card (uses kit8/ui/components/common/SelectItemFromListApp)
// Commands: crud/project/useProjectTreeFilters.ts. Saved in uxuiSettings.treeColumnsFilters / treeColumnSort.
export * from './treeColumnFilter';
export * from './treeFilterIconGeometry';
export { default as PMTreeColumnFilterPopup, PM_TREE_FILTER_POPUP_WIDTH } from './PMTreeColumnFilterPopup';
