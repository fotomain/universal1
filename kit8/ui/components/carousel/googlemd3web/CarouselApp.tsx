import React from 'react';
import { CarouselAppProps, VariantCarouselApp } from '../common';

export default function CarouselApp<T = any>(props: CarouselAppProps<T>) {
  return <VariantCarouselApp {...props} designVariant="googlemd3web" />;
}
