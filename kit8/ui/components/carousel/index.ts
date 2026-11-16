// common shared data, types, logos, and helpers
export * from './common';

// Design system flavors
export * as TamaguiCarousel from './tamagui';
export * as PaperCarousel from './paper';
export * as AppleMacUICarousel from './applemacui';
export * as AntCarousel from './ant';
export * as ExpoCarousel from './expo';
export * as GoogleMD3WebCarousel from './googlemd3web';
export * as NativeCarousel from './native';

// Auto-detecting top-level components (reads activeSystem from Settings)
export { default as CarouselApp } from './CarouselApp';
export { default as CarouselVendors, VENDOR_SLIDES } from './CarouselVendors';
