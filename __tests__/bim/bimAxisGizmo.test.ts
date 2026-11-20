import { axisGizmoAxes } from '../../kit8/pm/bim/view/BimAxisGizmo';
import { orbitPosition } from '../../kit8/pm/bim/view/bimCamera';

const by = (yaw: number, pitch: number) => Object.fromEntries(axisGizmoAxes(yaw, pitch).map((a) => [a.key, a]));

describe('the XYZ orientation gizmo', () => {
  it('looking north from the south (yaw 0, level): X to the right, Y up, Z towards the viewer, north away', () => {
    const a = by(0, 0);
    expect(a.X.x).toBeCloseTo(1, 6);
    expect(a.X.y).toBeCloseTo(0, 6);
    expect(a.Y.x).toBeCloseTo(0, 6);
    expect(a.Y.y).toBeCloseTo(-1, 6); // screen y goes DOWN: up is negative
    expect(a.Z.depth).toBeCloseTo(1, 6);
    expect(a.N.depth).toBeCloseTo(-1, 6);
  });

  it('Y (up) always points up on the screen for a camera above the horizon, whatever the yaw', () => {
    for (const yaw of [0, 0.7, 2, 4, 5.5]) expect(by(yaw, 0.5).Y.y).toBeLessThan(0);
  });

  it('a quarter turn of the camera: the X axis points at the viewer', () => {
    const a = by(Math.PI / 2, 0);
    expect(a.X.depth).toBeCloseTo(1, 6); // the camera is on the +X side now: X points TO the viewer
  });

  it('the depth is the cosine to the camera position of bimCamera (the same convention)', () => {
    const o = { target: [0, 0, 0] as [number, number, number], yaw: 0.9, pitch: 0.4, distance: 1 };
    const p = orbitPosition(o);
    const a = by(o.yaw, o.pitch);
    expect(a.X.depth).toBeCloseTo(p[0], 6);
    expect(a.Y.depth).toBeCloseTo(p[1], 6);
    expect(a.Z.depth).toBeCloseTo(p[2], 6);
    expect(a.N.depth).toBeCloseTo(-p[2], 6);
  });

  it('every axis stays inside the unit circle', () => {
    for (const a of axisGizmoAxes(1.3, -0.4)) expect(Math.hypot(a.x, a.y)).toBeLessThanOrEqual(1 + 1e-9);
  });
});
