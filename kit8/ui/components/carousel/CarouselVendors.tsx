import React from 'react';
import { DesignSystemType, useDesignSystem } from '../../../providers/WithDesignSystem';
import PaperCarouselVendors, { VENDOR_SLIDES as PAPER_SLIDES } from './paper/CarouselVendors';
import TamaguiCarouselVendors, { VENDOR_SLIDES as TAMAGUI_SLIDES } from './tamagui/CarouselVendors';
import AppleMacUICarouselVendors from './applemacui/CarouselVendors';
import AntCarouselVendors from './ant/CarouselVendors';
import ExpoCarouselVendors from './expo/CarouselVendors';
import GoogleMD3WebCarouselVendors from './googlemd3web/CarouselVendors';
import NativeCarouselVendors from './native/CarouselVendors';

export { TAMAGUI_SLIDES as VENDOR_SLIDES, PAPER_SLIDES };

export interface CarouselVendorsProps {
  maxWidth?: number;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  itemHeight?: number;
  showCategoryTabs?: boolean;
  /** Optional override; when omitted, auto-detects from Settings (`useDesignSystem().activeSystem`) */
  variant?: DesignSystemType;
}

/**
 * Top-level CarouselVendors component that auto-detects the active design system
 * from `http://localhost:8088/settings` (`useDesignSystem().activeSystem`) and renders
 * the matching design variant (`paper`, `tamagui`, `applemacui`, `ant`, `expo`, `googlemd3web`, `native`).
 */
export default function CarouselVendors({
  variant,
  ...props
}: CarouselVendorsProps) {
  let detectedSystem: DesignSystemType = 'paper';
  try {
    const ds = useDesignSystem();
    if (ds?.activeSystem) {
      detectedSystem = ds.activeSystem;
    }
  } catch {
    // fallback if outside provider
  }

  const targetSystem: DesignSystemType = variant || detectedSystem;

  switch (targetSystem) {
    case 'paper':
      return <PaperCarouselVendors {...props} />;
    case 'tamagui':
      return <TamaguiCarouselVendors {...props} />;
    case 'applemacui':
      return <AppleMacUICarouselVendors {...props} />;
    case 'ant':
      return <AntCarouselVendors {...props} />;
    case 'expo':
      return <ExpoCarouselVendors {...props} />;
    case 'googlemd3web':
      return <GoogleMD3WebCarouselVendors {...props} />;
    case 'native':
    default:
      return <NativeCarouselVendors {...props} />;
  }
}

