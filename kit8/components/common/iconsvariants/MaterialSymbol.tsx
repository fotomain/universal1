// MaterialSymbol.tsx
import React from 'react';
import * as MaterialSymbols from '@material-symbols-svg/react-native';
import { View, ViewStyle, StyleProp } from 'react-native';

const ROTATION_MAP: Record<string, string> = {
    expand_more: '90deg',
    expandmore: '90deg',
    'expand-more': '90deg',
    chevron_down: '90deg',
    chevrondown: '90deg',
    'chevron-down': '90deg',
    'chevron.down': '90deg',
    arrow_drop_down: '90deg',
    arrowdropdown: '90deg',
    'arrow-drop-down': '90deg',
    accordion_expand: '90deg',

    expand_less: '-90deg',
    expandless: '-90deg',
    'expand-less': '-90deg',
    chevron_up: '-90deg',
    chevronup: '-90deg',
    'chevron-up': '-90deg',
    'chevron.up': '-90deg',
    arrow_drop_up: '-90deg',
    arrowdropup: '-90deg',
    'arrow-drop-up': '-90deg',
    accordion_collapse: '-90deg',

    chevron_backward: '180deg',
    chevronbackward: '180deg',
    'chevron-backward': '180deg',
};

// Helper to convert snake_case to PascalCase (e.g., "arrow_back" -> "ArrowBack")
const ALIAS_MAP: Record<string, string> = {
    magnify: 'search',
    'magnify-plus-outline': 'zoom_in',
    'magnify-minus-outline': 'zoom_out',
    'trash-can-outline': 'delete',
    'trash-can': 'delete',
    'delete-outline': 'delete',
    'folder-upload-outline': 'drive_folder_upload',
    'folder-download-outline': 'folder_zip',
    'folder-image': 'folder',
    'folder-remove-outline': 'folder_off',
    'folder-account': 'account_circle',
    'file-document-outline': 'description',
    'file-outline': 'draft',
    'file-search-outline': 'find_in_page',
    'file-upload-outline': 'upload_file',
    'file-upload': 'upload_file',
    'image-outline': 'image',
    'image-plus': 'add_photo_alternate',
    'share-variant-outline': 'share',
    'share-variant': 'share',
    'rename-box': 'edit',
    'close-circle': 'cancel',
    'close-circle-outline': 'cancel',
    plus: 'add',
    close: 'close',
    'store-plus': 'storefront',
    'trending-up': 'trending_up',
    'tray-arrow-down': 'download',
    'cloud-upload-outline': 'cloud_upload',
    'cloud-upload': 'cloud_upload',
    'chevron-up': 'chevron_forward',
    'chevron.up': 'chevron_forward',
    chevronup: 'chevron_forward',
    'chevron-down': 'chevron_forward',
    'chevron.down': 'chevron_forward',
    chevrondown: 'chevron_forward',
    chevron_up: 'chevron_forward',
    chevron_down: 'chevron_forward',
    chevron_left: 'chevron_backward',
    chevron_right: 'chevron_forward',
    'chevron-left': 'chevron_backward',
    'chevron.left': 'chevron_backward',
    'chevron-right': 'chevron_forward',
    'chevron.right': 'chevron_forward',
    chevronleft: 'chevron_backward',
    chevronright: 'chevron_forward',
    chevron_forward: 'chevron_forward',
    chevronforward: 'chevron_forward',
    chevron_backward: 'chevron_backward',
    chevronbackward: 'chevron_backward',
    expand_more: 'chevron_forward',
    expandmore: 'chevron_forward',
    'expand-more': 'chevron_forward',
    expand_less: 'chevron_forward',
    expandless: 'chevron_forward',
    'expand-less': 'chevron_forward',
    accordion_expand: 'chevron_forward',
    accordion_collapse: 'chevron_forward',
};

const snakeToPascal = (str: string): string => {
    const norm = str.toLowerCase().replace(/[.-]/g, '_');
    const mapped = ALIAS_MAP[norm] || ALIAS_MAP[str.toLowerCase()] || str;
    return mapped
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
};

interface MaterialSymbolProps {
    /** Accepts snake_case names directly from fonts.google.com/icons (e.g., "arrow_back", "search") */
    name: string;
    size?: number;
    color?: string;
    /** Set to true for filled variant, or pass filled names like "home_fill" */
    filled?: boolean;
    style?: StyleProp<ViewStyle>;
}

export const MaterialSymbol: React.FC<MaterialSymbolProps> = ({
    name,
    size = 24,
    color = '#000000',
    filled = false,
    style,
}) => {
    if (!name) return null;

    const normKey = name.toLowerCase().replace(/[.-]/g, '_');

    // Normalize snake_case name to PascalCase
    let componentName = snakeToPascal(name);

    // Append 'Fill' if requested via boolean prop and not already present
    if (filled && !componentName.endsWith('Fill')) {
        componentName += 'Fill';
    }

    // Lookup component from module exports
    let IconComponent = (MaterialSymbols as Record<string, React.FC<any>>)[componentName];

    // Fallback if not found: try ChevronForward if it is any chevron or expand icon
    if (!IconComponent && (normKey.includes('chevron') || normKey.includes('expand') || normKey.includes('arrow'))) {
        componentName = 'ChevronForward';
        IconComponent = (MaterialSymbols as Record<string, React.FC<any>>)[componentName];
    }

    if (!IconComponent) {
        console.warn(`Material Symbol "${name}" (resolved as "${componentName}") was not found.`);
        return null;
    }

    const rotation = ROTATION_MAP[normKey] || ROTATION_MAP[name.toLowerCase()];

    if (rotation) {
        return (
            <View
                style={[
                    {
                        width: size,
                        height: size,
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: [{ rotate: rotation }],
                    },
                    style,
                ]}
            >
                <IconComponent width={size} height={size} fill={color} />
            </View>
        );
    }

    return <IconComponent width={size} height={size} fill={color} style={style} />;
};