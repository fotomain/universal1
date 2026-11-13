// The routes where the floating "+" button of the application (FABAppComponent) is NOT shown: screens whose own
// controls stand where the button floats. Pure: no React.
export const FAB_HIDDEN_ROUTES = ['/media/record/video'];

/** '/media/record/video', also with a trailing slash or a query */
export function fabHiddenOnRoute(pathname: string | null | undefined): boolean {
  const path = String(pathname || '').split('?')[0].replace(/\/+$/, '') || '/';
  return FAB_HIDDEN_ROUTES.includes(path);
}
