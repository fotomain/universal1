import React from 'react';
import { CarouselAppProps } from './common';
import { DesignSystemType, useDesignSystem } from '../../../providers/WithDesignSystem';
import PaperCarouselApp from './paper/CarouselApp';
import TamaguiCarouselApp from './tamagui/CarouselApp';
import AppleMacUICarouselApp from './applemacui/CarouselApp';
import AntCarouselApp from './ant/CarouselApp';
import ExpoCarouselApp from './expo/CarouselApp';
import GoogleMD3WebCarouselApp from './googlemd3web/CarouselApp';
import NativeCarouselApp from './native/CarouselApp';

/**
 * Top-level CarouselApp that automatically detects the active design system
 * from Settings (`useDesignSystem().activeSystem` — e.g. 'paper', 'tamagui',
 * 'applemacui', 'ant', 'expo', 'googlemd3web', 'native') or uses an explicit `variant` prop.
 */
export default function CarouselApp<T = any>({
  variant,
  ...props
}: CarouselAppProps<T>) {
  let detectedSystem: DesignSystemType = 'paper';
  try {
    const ds = useDesignSystem();
    if (ds?.activeSystem) {
      detectedSystem = ds.activeSystem;
    }
  } catch {
    // fallback if rendered outside WithDesignSystem provider
  }

  const targetSystem: DesignSystemType = variant || detectedSystem;

  switch (targetSystem) {
    case 'paper':
      return <PaperCarouselApp {...props} />;
    case 'tamagui':
      return <TamaguiCarouselApp {...props} />;
    case 'applemacui':
      return <AppleMacUICarouselApp {...props} />;
    case 'ant':
      return <AntCarouselApp {...props} />;
    case 'expo':
      return <ExpoCarouselApp {...props} />;
    case 'googlemd3web':
      return <GoogleMD3WebCarouselApp {...props} />;
    case 'native':
    default:
      return <NativeCarouselApp {...props} />;
  }
}

