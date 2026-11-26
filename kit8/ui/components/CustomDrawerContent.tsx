import React, { useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Pressable, useWindowDimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { DrawerContentScrollView, DrawerContentComponentProps } from 'expo-router/drawer';
import { Drawer as PaperDrawer } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from './common/IconApp';
import RecordMenuIcon from './common/RecordMenuIcon';
import { usePermissions } from '../../permissions/usePermissions';
import HamburgerMenuUnmovable from './HamburgerMenuUnmovable';
import { buildRouteLabels } from '../../catalog/user/visit/routeVisitModel';
import { afterNextPopState, isDrawerOpenInHistory, isFirefoxWeb } from './drawerHistorySettle';
import { useCloseFabsWhenDrawerOpens } from './useCloseFabsWhenDrawerOpens';
import { useRegisterDrawerCloser } from './drawerCloser';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  /** a drawn icon (SVG) instead of the named one: gets the size and the colour of the row. `icon` stays as the name for the lists (Top 5) */
  renderIcon?: (p: { size: number; color: string }) => React.ReactElement;
  route: string;
  /** accordion group (e.g. Catalogs): the row toggles, its children are compact sub-rows */
  children?: MenuItem[];
  /** a sub-row that is only a DIVIDER line between two parts of an accordion (no route, no label) */
  divider?: boolean;
  /** pinned part: something at the end of the row (a count, a switch) and what a press does instead of opening the route */
  right?: React.ReactNode;
  onPress?: () => void;
  /** a low row with a small regular text (the Top 5 of the pinned part) */
  compact?: boolean;
}

/** height of an accordion sub-row (Catalogs -> Currencies ...) */
export const DRAWER_SUBITEM_HEIGHT = 32;
/** window width from which the drawer of react-navigation is permanent (no close icon then) */
export const DRAWER_PERMANENT_MIN_WIDTH = 768;

export default function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { navigation } = props;
  // the hamburger (or a swipe) opened this drawer: an open floating button closes
  useCloseFabsWhenDrawerOpens((props as any).state);
  // ... and the other way round: the user opens the FAB while this menu is open -> the menu closes (the FAB calls closeDrawerIfOpen)
  useRegisterDrawerCloser(navigation as any, (props as any).state);
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { activeSystem, themeColors, isDark } = useDesignSystem();
  // react-navigation: the drawer is permanent from 768 px wide (web), a slide-out menu below it (phones, narrow windows)
  const { width: windowWidth } = useWindowDimensions();
  const slidesOut = windowWidth < DRAWER_PERMANENT_MIN_WIDTH;
  const permissions = usePermissions();   // PART 46 / 47: a screen the profiles of the user do not give (the members of the organization ...) is not listed

  const stateRef = useRef((props as any).state);
  stateRef.current = (props as any).state;

  const navigateAndClose = (route: string) => {
    const fullRoute = route.startsWith('/') ? route : `/${route}`;
    const go = () => {
      try {
        if ((router as any).navigate) {
          (router as any).navigate(fullRoute);
        } else {
          router.replace(fullRoute as any);
        }
      } catch (e) {
        router.replace(fullRoute as any);
      }
    };
    if (isFirefoxWeb() && isDrawerOpenInHistory((props as any).state)) {
      // see drawerHistorySettle.ts: close first, navigate when the browser has finished the history.go of the closing
      afterNextPopState(go);
      navigation.closeDrawer();
      return;
    }
    go();
    navigation.closeDrawer();
    // the new screen may start something that pauses the app (the Android camera permission dialog): if the menu is still open a moment later, close it again
    setTimeout(() => {
      if (isDrawerOpenInHistory(stateRef.current)) navigation.closeDrawer();
    }, 450);
  };

  const isCurrentRoute = (route: string) => {
    const cleanPath = (pathname || '').replace(/^\//, '').replace(/\/index$/, '');
    const cleanRoute = (route || '').replace(/^\//, '').replace(/\/index$/, '');
    return cleanPath === cleanRoute || (cleanPath === '' && cleanRoute === 'home');
  };

  const mainNavItems: MenuItem[] = [
    { id: 'home', label: t('menu.home'), icon: 'home', route: 'home' },
    { id: 'developer1', label: t('drawer.developer1'), icon: 'logo_dev', route: 'developer1' },
    { id: 'posts', label: t('drawer.mediaPosts'), icon: 'list_alt', route: 'posts/mediapostcrud' },
    // record with the camera / microphone and play audio / video (kit8/ui/components/media): web, iOS, Android
    {
      id: 'record',
      label: t('drawer.record'),
      icon: 'videocam',
      // negative-space camera + microphone monogram (black / white, takes the colour of the row)
      renderIcon: ({ size, color }) => <RecordMenuIcon size={size} color={color} />,
      route: '',
      children: [
        { id: 'record-video', label: t('drawer.video'), icon: 'videocam', route: 'media/record/video' },
        { id: 'record-audio', label: t('drawer.audio'), icon: 'mic', route: 'media/record/audio' },
        { id: 'record-photo', label: t('drawer.photo'), icon: 'photo_camera', route: 'media/record/photo' },
      ],
    },
    // scan with the camera (QR code, barcode) or with the NFC reader (kit8/ui/components/media/scan, .../nfc): open to guests too
    {
      id: 'scan',
      label: t('drawer.scan'),
      icon: 'qr_code_scanner',
      route: '',
      children: [
        { id: 'scan-codes', label: t('drawer.qrBarcode'), icon: 'qr_code_scanner', route: 'media/scan' },
        { id: 'scan-nfc', label: t('drawer.nfc'), icon: 'nfc', route: 'media/nfc' },
        // ID card or passport: photo of the zone -> text recognised on the phone -> NFC scan (kit8/ui/components/media/nfc/identification; the chip reader = nfc/iddocread)
        { id: 'scan-identification', label: t('drawer.identification'), icon: 'badge', route: 'media/nfc/identification' },
      ],
    },
    {
      id: 'play',
      label: t('drawer.play'),
      icon: 'play_circle',
      route: '',
      children: [
        { id: 'play-audio', label: t('drawer.audio'), icon: 'headphones', route: 'media/play/audio' },
        { id: 'play-video', label: t('drawer.video'), icon: 'movie', route: 'media/play/video' },
      ],
    },
    // the chat (kit8/chat): the themes of the user and the chats of the tasks he works on; the red number of the new messages is in the application bar
    { id: 'chat', label: t('drawer.chat'), icon: 'chat', route: 'chat' },
    {
      id: 'catalogs',
      label: t('drawer.catalogs'),
      icon: 'menu_book',
      route: '',
      // sorted by name
      children: [
        // activity genus (operating / investing / financing) + the allowed budget item keys activity x genus: read-only tables
        { id: 'activitygenus', label: t('drawer.activityGenus'), icon: 'swap_vert', route: 'catalog/management/activity_genus/list' },
        // budget items (articles a task line is budgeted as), each with its management genus: a tree of folders + a table
        { id: 'budgetitems', label: t('drawer.budgetItems'), icon: 'payments', route: 'catalog/budget/item/list' },
        // the scenarios a project budgets in (Plan | Fact): a plain table
        { id: 'budgetscenarios', label: t('drawer.budgetScenarios'), icon: 'flag', route: 'catalog/budget/scenario/list' },
        // the business units (a tree of any depth; cost / revenue / profit / investment centers) - replaces the old Departments catalog
        { id: 'businessunits', label: t('drawer.businessUnits'), icon: 'account_tree', route: 'catalog/business/unit' },
        { id: 'countries', label: t('drawer.countries'), icon: 'public', route: 'catalog/country' },
        { id: 'currencies', label: t('drawer.currencies'), icon: 'payments', route: 'catalog/currency/list' },
        // how a budget is spread over the days of a task line (front-loaded, uniform, normal ...): a read-only tree + table
        { id: 'distributions', label: t('drawer.distribution'), icon: 'stacked_line_chart', route: 'catalog/distribution/list' },
        // equipment: types (Heavy machinery, Vehicle), properties (what a machine is) and variants (what it can be booked as); a Time line of a task can book it
        { id: 'equipmentdashboard', label: t('drawer.equipmentProps'), icon: 'construction', route: 'catalog/equipment/dashboard' },
        { id: 'kanban-stages', label: t('drawer.kanbanStages'), icon: 'view_column', route: 'pm/kanbanstage/list' },
        // the companies the vendor invoices are issued to (folders = countries)
        { id: 'legalentities', label: t('drawer.legalEntities'), icon: 'domain', route: 'catalog/legal/entity' },
        // the working calendars (Project / Resource role / Person) and their days: a task plan skips the excluded days
        // the bank accounts and cash desks the payment facts move money on (folders = legal entities), with their rests
        { id: 'moneyaccounts', label: t('drawer.moneyAccounts'), icon: 'account_balance', route: 'catalog/money/account' },
        { id: 'managementcalendars', label: t('drawer.managementCalendars'), icon: 'calendar_month', route: 'catalog/management/calendar/list' },
        // management genus (costs: time / material / expense, revenue, payments): a read-only tree + table
        { id: 'managementgenus', label: t('drawer.managementGenus'), icon: 'hub', route: 'catalog/management/genus/list' },
        { id: 'organizations', label: t('drawer.organizations'), icon: 'corporate_fare', route: 'catalog/organization' },
        // who is a member of the active organization: invitations, administrators (organizationMemberTable)
        { id: 'organizationmembers', label: t('drawer.organizationMembers'), icon: 'group', route: 'catalog/organization/members' },
        { id: 'partners', label: t('drawer.partners'), icon: 'handshake', route: 'catalog/partner/list' },
        { id: 'persons', label: t('drawer.persons'), icon: 'person', route: 'catalog/person/list' },
        // persons: types (Employee / Contractor), properties (what a person is) and variants (what he can be booked as), ReusableTable approach
        { id: 'persondashboard', label: t('drawer.personsProps'), icon: 'badge', route: 'catalog/person/dashboard' },
        // product catalog: all product tables (CRUD), checks, product card
        { id: 'products', label: t('drawer.products'), icon: 'inventory_2', route: 'catalog/product/dashboard' },
        { id: 'catalog-projects', label: t('drawer.projects'), icon: 'view_timeline', route: 'catalog/project' },
        // the contract a task line asks for before a partner is known (Material / Expense / Revenue / Time), per management genus
        { id: 'templateresourcecontracts', label: t('drawer.resourceContractTemplates'), icon: 'description', route: 'catalog/management/templateresourcecontract/list' },
        // resource role catalog: role types, roles (folder tree + table), properties, variants, hourly rates, checks
        { id: 'resourceroles', label: t('drawer.resourceRoles'), icon: 'engineering', route: 'catalog/resourcerole/dashboard' },
        // a Person, an Equipment or a Partner (supplier) as a resource with its own calendar and variant, in folders = business units; a Time line of a task can book it
        { id: 'workcenters', label: t('drawer.workCenters'), icon: 'precision_manufacturing', route: 'catalog/work/center' },
      ],
    },
    // documents (what is filled in and posted), sorted by name: the fact input documents (Actuals, kit8/documents/fact/input) and the vendor invoices (one vendor + one contract each; folders legal entity → vendor)
    {
      id: 'documents',
      label: t('drawer.documents'),
      icon: 'description',
      route: '',
      children: [
        { id: 'documents-factinput', label: t('drawer.factInput'), icon: 'fact_check', route: 'pm/fact/list' },
        // ONE bank transaction: the payments of the plan that were really paid (folders money account → payee)
        { id: 'documents-paymentfacts', label: t('drawer.paymentFacts'), icon: 'account_balance', route: 'pm/payment-fact/list' },
        { id: 'documents-productreceipts', label: t('drawer.productReceipts'), icon: 'move_to_inbox', route: 'pm/product-receipt/list' },
        { id: 'documents-purchaseorders', label: t('drawer.purchaseOrders'), icon: 'shopping_cart', route: 'pm/purchase-order/list' },
        { id: 'documents-timesheets', label: t('drawer.timeSheets'), icon: 'schedule', route: 'pm/timesheet/list' },
        { id: 'documents-vendorinvoices', label: t('drawer.vendorInvoices'), icon: 'receipt_long', route: 'pm/vendor-invoice/list' },
        { id: 'documents-customerinvoices', label: t('drawer.customerInvoices'), icon: 'payments', route: 'pm/customer-invoice/list' },
      ],
    },
    { id: 'pm-projects', label: t('drawer.projectDashboard'), icon: 'timeline', route: 'pm/project/dashboard' },
    // the Estimation dashboard (kit8/pm/estimation): input, edit and export estimates; right under the Project dashboard
    { id: 'pm-estimation', label: t('drawer.estimationDashboard'), icon: 'calculate', route: 'pm/project/estimation/dashboard' },
    // reports: Monitor01 (planned · contracted · received · used per resource role, month and task; the FULL data set, live), Monitor02 ROI now, Monitor03 ROI history, Monitor07 Customer / Vendor balance, Monitor08 Consolidation
    {
      id: 'reports',
      label: t('drawer.reports'),
      icon: 'assessment',
      route: '',
      children: [
        { id: 'reports-monitor01', label: t('drawer.monitor01'), icon: 'monitoring', route: 'pm/reports/monitor01' },
        { id: 'reports-monitor02', label: t('drawer.monitor02'), icon: 'trending_up', route: 'pm/reports/monitor02' },
        { id: 'reports-monitor03', label: t('drawer.monitor03'), icon: 'show_chart', route: 'pm/reports/monitor03' },
        { id: 'reports-monitor07-customer', label: t('drawer.monitor07Customer'), icon: 'account_balance', route: 'pm/reports/monitor07/customer' },
        { id: 'reports-monitor07-vendor', label: t('drawer.monitor07Vendor'), icon: 'account_balance_wallet', route: 'pm/reports/monitor07/vendor' },
        { id: 'reports-monitor08', label: t('drawer.monitor08'), icon: 'currency_exchange', route: 'pm/reports/monitor08' },
      ],
    },

    // budgets: shortcuts to the catalogs a budget is built from (the same pages as in Catalogs), sorted by name
    {
      id: 'budgets',
      label: t('drawer.budgets'),
      icon: 'account_balance_wallet',
      route: '',
      children: [
        { id: 'budgets-activitygenus', label: t('drawer.activityGenus'), icon: 'swap_vert', route: 'catalog/management/activity_genus/list' },
        { id: 'budgets-budgetitems', label: t('drawer.budgetItems'), icon: 'payments', route: 'catalog/budget/item/list' },
        { id: 'budgets-budgetscenarios', label: t('drawer.budgetScenarios'), icon: 'flag', route: 'catalog/budget/scenario/list' },
        { id: 'budgets-businessunits', label: t('drawer.businessUnits'), icon: 'account_tree', route: 'catalog/business/unit' },
        { id: 'budgets-templateresourcecontracts', label: t('drawer.resourceContractTemplates'), icon: 'description', route: 'catalog/management/templateresourcecontract/list' },
        { id: 'budgets-resourceroles', label: t('drawer.resourceRoles'), icon: 'engineering', route: 'catalog/resourcerole/dashboard' },
      ],
    },

    // system settings of the user: how often each screen was opened (kit8/catalog/user/visit)
    {
      id: 'systemsettings',
      label: t('drawer.systemSettings'),
      icon: 'settings_applications',
      route: '',
      children: [{ id: 'system-routevisits', label: t('drawer.routesVisits'), icon: 'route', route: 'user/visits' }, { id: 'system-permissions', label: t('drawer.permissions'), icon: 'admin_panel_settings', route: 'user/permissions' }, { id: 'system-texts', label: t('drawer.applicationTexts'), icon: 'translate', route: 'catalog/organization/texts' }, { id: 'system-costcalculator', label: t('drawer.costCalculator'), icon: 'calculate', route: 'system/costcalculator' }, { id: 'system-initialdata', label: t('drawer.createInitialData'), icon: 'database', route: 'system/initialdata' }],
    },
  ];

  // route -> name for the Top 5 of the pinned part: the rows of this menu first (leaves of the groups too), then the title of every other screen of the drawer
  const flatten = (items: MenuItem[]): MenuItem[] => items.flatMap((i) => (i.children ? flatten(i.children) : i.divider ? [] : [i]));
  const screenTitles = ((props as any).state?.routes || []).map((r: any) => {
    const o = (props as any).descriptors?.[r.key]?.options;
    return { route: r.name, label: typeof o?.drawerLabel === 'string' ? o.drawerLabel : o?.title };
  });
  const routeLabels = buildRouteLabels([...flatten(mainNavItems), ...screenTitles]);
  const routeIcons = buildRouteLabels(flatten(mainNavItems).map((i) => ({ route: i.route, label: i.icon })));

  // ---- accordion groups: open / closed; a group opens by itself while one of its pages is shown ----
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const groupHasActive = (item: MenuItem) => !!item.children?.some((c) => !c.divider && (isCurrentRoute(c.route) || isCurrentRoute(c.route.replace(/\/list$/, '/edit'))));
  const isGroupOpen = (item: MenuItem) => openGroups[item.id] ?? groupHasActive(item);
  const pressItem = (item: MenuItem) => {
    if (item.onPress) item.onPress();
    else if (!item.route && !item.children) return;
    else if (item.children) setOpenGroups((g) => ({ ...g, [item.id]: !isGroupOpen(item) }));
    else navigateAndClose(item.route);
  };
  /** tamagui paints the active row in the primary color -> white chevron there */
  const chevronColor = (active: boolean) => (active && activeSystem === 'tamagui' ? '#ffffff' : themeColors.text);
  /** chevron at the end of a group row (▾ open / ▸ closed) */
  const groupChevron = (item: MenuItem, color: string) =>
    item.children ? (
      <View style={{ marginLeft: 'auto', transform: [{ rotate: isGroupOpen(item) ? '90deg' : '0deg' }] }} testID={`drawer-group-chevron-${item.id}`}>
        <IconApp name="chevron_forward" size={18} color={color} />
      </View>
    ) : null;

  /** compact sub-row of an accordion group */
  const renderSubItem = (item: MenuItem) => {
    if (item.divider) return <View key={item.id} testID={`drawer-divider-${item.id}`} accessibilityRole="none" style={{ height: StyleSheet.hairlineWidth, marginVertical: 4, marginHorizontal: 12, backgroundColor: themeColors.text + '33' }} />;
    const active = isCurrentRoute(item.route);
    return (
      <TouchableOpacity
        key={item.id}
        testID={`drawer-subitem-${item.id}`}
        accessibilityRole="menuitem"
        onPress={() => navigateAndClose(item.route)}
        activeOpacity={0.7}
        style={[
          styles.subItem,
          {
            backgroundColor: active ? themeColors.primary + '18' : 'transparent',
            borderLeftColor: active ? themeColors.primary : 'transparent',
          },
        ]}
      >
        <IconApp name={item.renderIcon ?? item.icon} size={16} color={active ? themeColors.primary : themeColors.text} style={{ marginRight: 10 }} />
        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: active ? '700' : '400', color: active ? themeColors.primary : themeColors.text }}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  /** a normal row, or a group row + (when open) its compact sub-rows */
  const renderNavEntry = (item: MenuItem) =>
    item.children ? (
      <View key={item.id} testID={`drawer-group-${item.id}`}>
        {renderDrawerItem(item)}
        {isGroupOpen(item) && <View testID={`drawer-group-items-${item.id}`}>{item.children.filter((ch) => (ch.id !== 'organizationmembers' || permissions.canUi('permissionOrganizationMembers', 'R')) && (ch.id !== 'system-texts' || permissions.canUi('permissionEditTexts', 'R')) && (ch.id !== 'system-costcalculator' || permissions.isAdmin) && (ch.id !== 'system-initialdata' || permissions.isAdmin)).map(renderSubItem)}</View>}
      </View>
    ) : (
      renderDrawerItem(item)
    );

  /** a low row, small regular text; its icon and text stand in the columns of the normal rows (paper / tamagui: 12 margin + 16 padding, icon box 24, 12 gap) */
  const renderCompactItem = (item: MenuItem) => {
    const wide = activeSystem === 'paper' || activeSystem === 'tamagui';
    return (
      <TouchableOpacity
        key={item.id}
        testID={`drawer-item-${item.id}`}
        onPress={() => pressItem(item)}
        activeOpacity={0.7}
        style={{ flexDirection: 'row', alignItems: 'center', minHeight: 28, marginHorizontal: wide ? 12 : 0, paddingLeft: 16, paddingRight: 12 }}
      >
        <View style={{ width: wide ? 24 : 20, alignItems: 'center' }}>
          <IconApp name={item.renderIcon ?? item.icon} size={16} color={themeColors.text} />
        </View>
        <Text numberOfLines={1} style={{ flex: 1, marginLeft: 12, fontSize: 13, fontWeight: '400', color: themeColors.text }}>
          {item.label}
        </Text>
        {item.right}
      </TouchableOpacity>
    );
  };

  const renderDrawerItem = (item: MenuItem) => {
    if (item.compact) return renderCompactItem(item);
    // a group row is "active" (highlighted) only while closed and one of its pages is shown
    const active = item.children ? !isGroupOpen(item) && groupHasActive(item) : !item.onPress && !!item.route && isCurrentRoute(item.route);

    switch (activeSystem) {
      case 'paper': {
        return (
          <PaperDrawer.Item
            key={item.id}
            testID={`drawer-item-${item.id}`}
            label={item.label}
            icon={(iconProps) => <IconApp testID="c42a9bde-7bf5-2cd4-6mr8-901234567e29" name={item.renderIcon ?? item.icon} size={iconProps.size} color={iconProps.color} />}
            active={active}
            right={item.right ? () => <>{item.right}</> : item.children ? () => groupChevron(item, themeColors.text) : undefined}
            onPress={() => pressItem(item)}
          />
        );
      }

      case 'tamagui': {
        return (
          <TouchableOpacity
            key={item.id}
            testID={`drawer-item-${item.id}`}
            onPress={() => pressItem(item)}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: active ? themeColors.primary : isDark ? '#1f2937' : '#f9fafb',
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 16,
              marginVertical: 4,
              marginHorizontal: 12,
              borderWidth: 1,
              borderColor: active ? themeColors.primary : themeColors.border,
            }}
          >
            <IconApp testID="d53b0cef-8ca6-3de5-7ns9-012345678f30" name={item.renderIcon ?? item.icon} size={20} color={active ? '#ffffff' : themeColors.text} style={{ marginRight: 12 }} />
            <Text style={{ fontSize: 15, fontWeight: active ? '700' : '500', color: active ? '#ffffff' : themeColors.text, flex: 1 }}>
              {item.label}
            </Text>
            {active && <IconApp testID="e64c1df0-9db7-4ef6-8ot0-123456789a31" name="check" size={16} color="#ffffff" />}
            {item.right ? <View style={{ marginLeft: 'auto' }}>{item.right}</View> : null}
            {groupChevron(item, chevronColor(active))}
          </TouchableOpacity>
        );
      }

      case 'ant': {
        return (
          <TouchableOpacity
            key={item.id}
            testID={`drawer-item-${item.id}`}
            onPress={() => pressItem(item)}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: active ? themeColors.primary + '15' : 'transparent',
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderBottomWidth: 1,
              borderBottomColor: themeColors.border,
            }}
          >
            <IconApp testID="f75d2e01-0ec8-5fg7-9pu1-234567890b32" name={item.renderIcon ?? item.icon} size={20} color={active ? themeColors.primary : themeColors.text} style={{ marginRight: 12 }} />
            <Text style={{ fontSize: 15, fontWeight: active ? '600' : '400', color: active ? themeColors.primary : themeColors.text, flex: 1 }}>
              {item.label}
            </Text>
            {item.right ? <View style={{ marginLeft: 'auto' }}>{item.right}</View> : null}
            {groupChevron(item, chevronColor(active))}
          </TouchableOpacity>
        );
      }

      case 'expo': {
        return (
          <TouchableOpacity
            key={item.id}
            testID={`drawer-item-${item.id}`}
            onPress={() => pressItem(item)}
            activeOpacity={0.85}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: active ? themeColors.primary : isDark ? '#1e293b' : '#f1f5f9',
              borderRadius: 20,
              paddingVertical: 12,
              paddingHorizontal: 18,
              marginVertical: 4,
              marginHorizontal: 10,
            }}
          >
            <IconApp testID="a86e3f12-1fd9-6gh8-0qv2-345678901c33" name={item.renderIcon ?? item.icon} size={20} color={active ? '#ffffff' : themeColors.primary} style={{ marginRight: 12 }} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: active ? '#ffffff' : themeColors.text, flex: 1 }}>
              {item.label}
            </Text>
            {item.right ? <View style={{ marginLeft: 'auto' }}>{item.right}</View> : null}
            {groupChevron(item, chevronColor(active))}
          </TouchableOpacity>
        );
      }

      case 'native':
      default: {
        return (
          <TouchableOpacity
            key={item.id}
            testID={`drawer-item-${item.id}`}
            onPress={() => pressItem(item)}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: active ? themeColors.surface : 'transparent',
              paddingVertical: 12,
              paddingHorizontal: 16,
              marginVertical: 2,
              borderLeftWidth: active ? 4 : 0,
              borderLeftColor: themeColors.primary,
            }}
          >
            <IconApp testID="b97f4023-2ge0-7hi9-1rw3-456789012d34" name={item.renderIcon ?? item.icon} size={20} color={active ? themeColors.primary : themeColors.text} style={{ marginRight: 12 }} />
            <Text style={{ fontSize: 15, fontWeight: active ? '700' : '400', color: active ? themeColors.primary : themeColors.text }}>
              {item.label}
            </Text>
            {item.right ? <View style={{ marginLeft: 'auto' }}>{item.right}</View> : null}
            {groupChevron(item, chevronColor(active))}
          </TouchableOpacity>
        );
      }
    }
  };

  return (
    // a tap on a FREE (empty) place of the menu closes it; the rows are touchables of their own and take their taps first
    <Pressable
      testID="drawer-empty-space"
      accessible={false}
      focusable={false}
      onPress={() => navigation.closeDrawer()}
      style={{ flex: 1, backgroundColor: themeColors.surface, cursor: 'default' } as any}
    >
      <DrawerContentScrollView {...props} contentContainerStyle={{ flexGrow: 1, paddingStart: 0, paddingEnd: 0 }}>
        {/* Header Badge adapted to design system */}
        <View
          style={[
            styles.drawerHeader,
            {
              borderBottomColor: themeColors.border,
              backgroundColor: activeSystem === 'tamagui' ? (isDark ? '#1f2937' : '#f8fafc') : 'transparent',
              paddingVertical: activeSystem === 'expo' ? 20 : 16,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: '800',
                color: themeColors.text,
              }}
            >
              {t('appName')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  backgroundColor: themeColors.primary + '20',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 10,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '800', color: themeColors.primary }}>
                  {activeSystem.toUpperCase()}
                </Text>
              </View>
              {/* close icon at the right top: only while the menu slides out (a permanent menu of a wide window cannot be closed) */}
              {slidesOut && (
                <TouchableOpacity
                  testID="drawer-close-button"
                  accessibilityRole="button"
                  accessibilityLabel={t('drawer.close')}
                  onPress={() => navigation.closeDrawer()}
                  hitSlop={10}
                  activeOpacity={0.7}
                  style={{ marginLeft: 12, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
                >
                  <IconApp name="close" size={22} color={themeColors.text} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {mainNavItems.map(renderNavEntry)}
      </DrawerContentScrollView>

      {/* Pinned bottom section of the left menu: Top 5 visited routes, user profile, settings, language, theme */}
      <HamburgerMenuUnmovable renderItem={renderDrawerItem} onSelectLanguage={() => navigation.closeDrawer()} onSelectRoute={navigateAndClose} routeLabels={routeLabels} routeIcons={routeIcons} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  drawerHeader: { paddingHorizontal: 16, borderBottomWidth: 1, marginBottom: 8 },
  subItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: DRAWER_SUBITEM_HEIGHT,
    paddingLeft: 48,
    paddingRight: 12,
    marginHorizontal: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
  },
});
