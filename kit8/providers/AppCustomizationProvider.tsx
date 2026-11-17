// AppCustomizationProvider - what the CURRENT APP (APP_NAME) adds to the shared screens. The shared code (kit8/) asks this context through
// named extension points and works without an answer; the registry that maps an app name to its customization is apps/appCustomization.ts
// (the root layout puts the value here). kit8 never imports from apps/ and never compares the app name. Rules: documentation/APP_CUSTOMIZATION_RULES.html.
import React, { createContext, useContext } from 'react';

/** what an action of the app can use when it runs */
export interface AppActionContext {
  router: { push: (to: any) => void };
  /** a signed-in user (the database user is known) */
  signedIn: boolean;
}

/** an item the app ADDS to the main floating button (FABAppComponent), on the routes it names */
export interface AppFabAction {
  /** stable id (tests, duplicates) */
  id: string;
  /** English text; the FAB translates it (pmT) */
  label: string;
  /** icon of the icon set of the FAB (MaterialCommunityIcons name) */
  icon: string;
  /** the routes where it shows: '/home' ... , or '*' = every route */
  routes: string[] | '*';
  color?: string;
  run: (ctx: AppActionContext) => void;
}

/** every field optional: an app says only what it changes */
export interface AppCustomization {
  /** the home page (replaces the default one) */
  homeComponent?: React.ComponentType<any>;
  /** items added to the main FAB: listed top to bottom as the user sees them; they stand NEAREST the button, under the items the FAB has anyway */
  fabExtraActions?: AppFabAction[];
}

export const EMPTY_APP_CUSTOMIZATION: AppCustomization = {};

const AppCustomizationContext = createContext<AppCustomization>(EMPTY_APP_CUSTOMIZATION);

export function AppCustomizationProvider({ value, children }: { value: AppCustomization; children: React.ReactNode }) {
  return <AppCustomizationContext.Provider value={value}>{children}</AppCustomizationContext.Provider>;
}

/** the customization of the current app; the empty one outside a provider (tests, other roots) */
export const useAppCustomization = (): AppCustomization => useContext(AppCustomizationContext);
