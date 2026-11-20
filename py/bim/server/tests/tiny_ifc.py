"""Builds a tiny IFC4 model for the tests with ifcopenshell.api: 2 storeys (the upper one made FIRST, so the order must come from the elevation),
3 walls (2 on the ground floor, 1 above) and 2 doors of ONE type on the ground floor; a slab that belongs to no storey (building level)."""
import ifcopenshell
import ifcopenshell.api
import ifcopenshell.api.aggregate
import ifcopenshell.api.context
import ifcopenshell.api.geometry
import ifcopenshell.api.root
import ifcopenshell.api.spatial
import ifcopenshell.api.unit
import ifcopenshell.api.project
import ifcopenshell.api.type
import ifcopenshell.api.pset
import ifcopenshell.api.style
import numpy as np


def _matrix(x, y, z):
    m = np.eye(4)
    m[:3, 3] = (x, y, z)
    return m


def make_tiny_ifc(path: str) -> dict:
    f = ifcopenshell.api.project.create_file(version='IFC4')
    project = ifcopenshell.api.root.create_entity(f, ifc_class='IfcProject', name='Tiny')
    ifcopenshell.api.unit.assign_unit(f, length={'is_metric': True, 'raw': 'METERS'})   # the API default is millimetres; the feet of example 1 are tested with the real file
    ctx = ifcopenshell.api.context.add_context(f, context_type='Model')
    body = ifcopenshell.api.context.add_context(f, context_type='Model', context_identifier='Body', target_view='MODEL_VIEW', parent=ctx)
    site = ifcopenshell.api.root.create_entity(f, ifc_class='IfcSite', name='Site')
    building = ifcopenshell.api.root.create_entity(f, ifc_class='IfcBuilding', name='Building')
    ifcopenshell.api.aggregate.assign_object(f, products=[site], relating_object=project)
    ifcopenshell.api.aggregate.assign_object(f, products=[building], relating_object=site)
    upper = ifcopenshell.api.root.create_entity(f, ifc_class='IfcBuildingStorey', name='Level 2')
    upper.Elevation = 3.0
    ground = ifcopenshell.api.root.create_entity(f, ifc_class='IfcBuildingStorey', name='Level 1')
    ground.Elevation = 0.0
    ifcopenshell.api.aggregate.assign_object(f, products=[upper, ground], relating_object=building)
    out = {'walls': [], 'doors': []}

    def add(cls, name, storey, x, y, z, size):
        e = ifcopenshell.api.root.create_entity(f, ifc_class=cls, name=name)
        rep = ifcopenshell.api.geometry.add_wall_representation(f, context=body, length=size[0], height=size[2], thickness=size[1])
        ifcopenshell.api.geometry.assign_representation(f, product=e, representation=rep)
        ifcopenshell.api.geometry.edit_object_placement(f, product=e, matrix=_matrix(x, y, z))
        if storey is not None:
            ifcopenshell.api.spatial.assign_container(f, products=[e], relating_structure=storey)
        else:
            ifcopenshell.api.spatial.assign_container(f, products=[e], relating_structure=building)
        return e

    out['walls'] = [add('IfcWall', 'Wall A', ground, 0, 0, 0, (5, 0.2, 3)), add('IfcWall', 'Wall B', ground, 5, 0, 0, (4, 0.2, 3)), add('IfcWall', 'Wall C', upper, 0, 0, 3, (5, 0.2, 3))]
    door_type = ifcopenshell.api.root.create_entity(f, ifc_class='IfcDoorType', name='Door 900')
    for i in range(2):
        d = add('IfcDoor', f'Door {i + 1}', ground, 1 + i * 2, 0, 0, (0.9, 0.1, 2.1))
        ifcopenshell.api.type.assign_type(f, related_objects=[d], relating_type=door_type)
        out['doors'].append(d)
    slab = add('IfcSlab', 'Roof slab', None, 0, 0, 6, (5, 0.3, 0.3))
    ps = ifcopenshell.api.pset.add_pset(f, product=out['walls'][0], name='Pset_WallCommon')
    ifcopenshell.api.pset.edit_pset(f, pset=ps, properties={'IsExternal': True, 'FireRating': '2HR'})
    f.write(path)
    out['slab'] = slab
    return out
