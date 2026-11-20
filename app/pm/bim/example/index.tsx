import React from 'react';
import BimExampleDemo from '../../../../kit8/pm/bim/view/BimExampleDemo';

// route: /pm/bim/example (?example=2 = the Duplex Apartment) - BIM example 1 (Structure Walls) or 2 in 3D without a database (the converted examples are part of the repository)
export default function BimExampleRoute() {
  return <BimExampleDemo />;
}
