// symbolConfig.ts
import { SFSymbol } from 'expo-symbols';

export interface PlatformSymbols {
    ios: SFSymbol;
    android: string;
}

/**
 * Historical legacy alias mapping layer.
 * Normalizes old Google Material Icon web syntax directly to modern system tokens.
 */
const MATERIAL_LEGACY_MAP: Record<string, string> = {
    'account_alt': 'account_circle',
    'perm_identity': 'person',
    'door_back_door': 'door_back',
    'door_front_door': 'door_front',
    'error_circle_rounded_error': 'error_circle_rounded',
    'power_rounded_power': 'power_settings_new',
    'expension_panels': 'expand_more',
    'today': 'calendar_today',
    'stars': 'star',
    'crosshairs-gps': 'my_location',
    'crosshairs_gps': 'my_location',
    'format-vertical-align-top': 'vertical_align_top',
    'format_vertical_align_top': 'vertical_align_top',
    'format-vertical-align-bottom': 'vertical_align_bottom',
    'format_vertical_align_bottom': 'vertical_align_bottom',
};

/**
 * Global application symbol mapping registry.
 * Maps standard, modernized cross-platform web tokens to native system assets.
 */
export const CORE_SYMBOL_REGISTRY: Record<string, PlatformSymbols> = {
    // --- Navigation & Core Architecture ---
    home: { ios: 'house', android: 'home' },
    search: { ios: 'magnifyingglass', android: 'search' },
    settings: { ios: 'gearshape', android: 'settings' },
    menu: { ios: 'line.3.horizontal', android: 'menu' },
    // more_vert: { ios: 'ellipsis.vertical', android: 'more_vert' },
    more_horiz: { ios: 'ellipsis', android: 'more_horiz' },
    refresh: { ios: 'arrow.clockwise', android: 'refresh' },
    close: { ios: 'xmark', android: 'close' },
    apps: { ios: 'square.grid.3x3.fill', android: 'apps' },
    my_location: { ios: 'location.circle', android: 'my_location' },
    vertical_align_top: { ios: 'arrow.up.to.line', android: 'vertical_align_top' },
    vertical_align_bottom: { ios: 'arrow.down.to.line', android: 'vertical_align_bottom' },
    'crosshairs-gps': { ios: 'location.circle', android: 'my_location' },
    'format-vertical-align-top': { ios: 'arrow.up.to.line', android: 'vertical_align_top' },
    'format-vertical-align-bottom': { ios: 'arrow.down.to.line', android: 'vertical_align_bottom' },

    // --- Users & Profiles ---
    account_circle: { ios: 'person.crop.circle', android: 'account_circle' },
    person: { ios: 'person', android: 'person' },
    // people: { ios: 'people', android: 'people' },
    group: { ios: 'person.3', android: 'group' },
    // manage_accounts: { ios: 'person.badge.gearshape', android: 'manage_accounts' },

    // --- Actions & Forms ---
    add: { ios: 'plus', android: 'add' },
    remove: { ios: 'minus', android: 'remove' },
    check: { ios: 'checkmark', android: 'check' },
    done: { ios: 'checkmark.circle', android: 'done' },
    delete: { ios: 'trash', android: 'delete' },
    edit: { ios: 'pencil', android: 'edit' },
    share: { ios: 'square.and.arrow.up', android: 'share' },
    favorite: { ios: 'heart', android: 'favorite' },
    star: { ios: 'star', android: 'star' },
    bookmark: { ios: 'bookmark', android: 'bookmark' },

    // --- Directions & Arrows ---
    arrow_back: { ios: 'chevron.left', android: 'arrow_back' },
    arrow_forward: { ios: 'chevron.right', android: 'arrow_forward' },
    chevron_left: { ios: 'chevron.left', android: 'chevron_left' },
    chevron_right: { ios: 'chevron.right', android: 'chevron_right' },
    expand_more: { ios: 'chevron.down', android: 'expand_more' },
    expand_less: { ios: 'chevron.up', android: 'expand_less' },

    // --- Media & Sound ---
    play_arrow: { ios: 'play', android: 'play_arrow' },
    pause: { ios: 'pause', android: 'pause' },
    stop: { ios: 'stop', android: 'stop' },
    volume_up: { ios: 'speaker.wave.3', android: 'volume_up' },
    volume_off: { ios: 'speaker.slash', android: 'volume_off' },
    videocam: { ios: 'video', android: 'videocam' },
    image: { ios: 'photo', android: 'image' },

    // --- Communication & Status ---
    mail: { ios: 'envelope', android: 'mail' },
    chat: { ios: 'bubble.left', android: 'chat' },
    notifications: { ios: 'bell', android: 'notifications' },
    call: { ios: 'phone', android: 'call' },
    info: { ios: 'info.circle', android: 'info' },
    help: { ios: 'questionmark.circle', android: 'help' },
    warning: { ios: 'exclamationmark.triangle', android: 'warning' },
    error: { ios: 'exclamationmark.circle', android: 'error' },

    // --- Commerce & Tools ---
    shopping_cart: { ios: 'cart', android: 'shopping_cart' },
    shopping_bag: { ios: 'bag', android: 'shopping_bag' },
    credit_card: { ios: 'creditcard', android: 'credit_card' },
    calendar_today: { ios: 'calendar', android: 'calendar_today' },
    location_on: { ios: 'mappin.and.ellipse', android: 'location_on' },
    lock: { ios: 'lock', android: 'lock' },
    visibility: { ios: 'eye', android: 'visibility' },
    visibility_off: { ios: 'eye.slash', android: 'visibility_off' },

    // --- Structures & Architecture ---
    door_back: { ios: 'door.right.hand.closed', android: 'door_back' },
    door_front: { ios: 'door.left.hand.open', android: 'door_front' },
};

/**
 * Type-safe helper extraction engine.
 * Converts input strings safely across layout environments.
 */



export function resolveSymbolNames(inputName: string): any  {
    // 1. Swap the incoming legacy naming token if it matches the registry
    const modernizedName = MATERIAL_LEGACY_MAP[inputName] || inputName;

    // 2. Locate matching assets inside our platform dictionary
    const match:PlatformSymbols = CORE_SYMBOL_REGISTRY[modernizedName];
    if (match) {
        return match;
    }

    const retErrorIcon:PlatformSymbols = CORE_SYMBOL_REGISTRY['help'];
    console.log("error, name not exist ",inputName,modernizedName,retErrorIcon)
    // 3. Fail-safe boundary if developer parses a string not mapped manually yet
    // return retErrorIcon
    return null
}
