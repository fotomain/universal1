// WebSymbolView.tsx
import React from 'react';
import { SymbolView } from 'expo-symbols';

import {resolveSymbolNames} from './symbolConfig';
import {MaterialSymbol} from "./MaterialSymbol";

interface WebSymbolViewProps {
    /**
     * Accepts modern material tokens, legacy web keys ('account_alt'),
     * or mapped cross-platform aliases.
     */
    name: string;
    size?: number;
    tintColor?: string;
}

export function PlatformOrientedIcon({ name, size = 24, tintColor }: WebSymbolViewProps) {
    const resolved:any = resolveSymbolNames(name);

    console.log("resolved1",resolved)

    if (null === resolved) {
        return(<MaterialSymbol
            name={name}
            size={size}
            color={tintColor}
        />)
    }


    return (
        <SymbolView
            name={{
                ios: resolved.ios,
                android: resolved.android,
                web: resolved.android, // Reuses Material Symbols architecture natively for browser builds
            }}
            size={size}
            tintColor={tintColor}
        />
    );
}
