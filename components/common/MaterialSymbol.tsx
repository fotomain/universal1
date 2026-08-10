// MaterialSymbol.tsx
// <MaterialSymbol name="home" size={32} color="#6750A4" />
// <MaterialSymbol name="arrow_back" size={32} color="#1C1B1F" />
// <MaterialSymbol name="shopping_cart" size={32} color="#1C1B1F" />
//
// {/* Filled icon via boolean prop */}
// <MaterialSymbol name="home" filled size={32} color="#6750A4" />

{/* Filled icon via name string */}
// <MaterialSymbol name="shopping_cart_fill" size={32} color="#6750A4" />

import React from 'react';
import * as MaterialSymbols from '@material-symbols-svg/react-native';
import { ViewStyle } from 'react-native';

// Helper to convert snake_case to PascalCase (e.g., "arrow_back" -> "ArrowBack")
const snakeToPascal = (str: string): string =>
    str
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');

interface MaterialSymbolProps {
    /** Accepts snake_case names directly from fonts.google.com/icons (e.g., "arrow_back", "search") */
    name: string;
    size?: number;
    color?: string;
    /** Set to true for filled variant, or pass filled names like "home_fill" */
    filled?: boolean;
    style?: ViewStyle;
}

export const MaterialSymbol: React.FC<MaterialSymbolProps> = ({
                                                                  name,
                                                                  size = 24,
                                                                  color = '#000000',
                                                                  filled = false,
                                                                  style,
                                                              }) => {
    // Normalize snake_case name to PascalCase
    let componentName = snakeToPascal(name);

    // Append 'Fill' if requested via boolean prop and not already present
    if (filled && !componentName.endsWith('Fill')) {
        componentName += 'Fill';
    }

    // Lookup component from module exports
    const IconComponent = (MaterialSymbols as Record<string, React.FC<any>>)[componentName];

    if (!IconComponent) {
        console.warn(`Material Symbol "${name}" (resolved as "${componentName}") was not found.`);
        return null;
    }

    return <IconComponent width={size} height={size} fill={color} style={style} />;
};