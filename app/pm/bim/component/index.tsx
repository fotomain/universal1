import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import PMBimComponentScreen from '../../../../kit8/pm/bim/component/PMBimComponentScreen';
import { parseBimComponentParams } from '../../../../kit8/pm/bim/component/bimComponentModel';

// route: /pm/bim/component?projectGUID=<uuid>&elementGUID=<IFC GlobalId>&taskGUID=<uuid, optional>&returnTo=<path, optional>
// ONE component of a BIM model: only it in 3D, its IFC properties, the edit tables of its task under the image, a full screen button, Back
export default function BimComponentRoute() {
  const params = useLocalSearchParams();
  const link = parseBimComponentParams(params);
  return <PMBimComponentScreen key={link ? `${link.projectGUID}:${link.elementGUID}` : 'none'} link={link} />;
}
