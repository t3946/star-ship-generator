// Satellite dish: closed shell bowl on a pedestal with a clearance-safe tilt.
// Base at p sits on the deck; the dish opens along its local +Z and is pitched
// up so the rim never digs into the platform.
import { drum, cdrum, concat, quad } from './geom.js';

function offsetZ(soup, dz) {
  const out = soup.slice();
  for (let i = 2; i < out.length; i += 3) out[i] += dz;
  return out;
}
function offset(soup, d) {
  const out = soup.slice();
  for (let i = 0; i < out.length; i += 3) {
    out[i] += d[0]; out[i + 1] += d[1]; out[i + 2] += d[2];
  }
  return out;
}

/**
 * Dish antenna standing on deck point p.
 *
 * Signature (compat):
 *   addDish(b, p, radius, rot = [-elev, yaw, 0], { mirror })
 *   addDish(b, p, radius, { elev, yaw, mirror, seg })
 *
 * rot[0] is pitch about X (negative = look up); rot[1] is yaw about Y.
 */
export function addDish(b, p, radius, rotOrOpts = [-0.95, 0.55, 0], maybeOpts = {}) {
  const R = Math.max(radius, 1e-4);
  const legacy = Array.isArray(rotOrOpts);
  const opts = legacy ? maybeOpts : (rotOrOpts || {});
  const elev = legacy ? -rotOrOpts[0] : (opts.elev ?? 0.95);
  const yaw = legacy ? (rotOrOpts[1] ?? 0) : (opts.yaw ?? 0.55);
  const roll = legacy ? (rotOrOpts[2] ?? 0) : (opts.roll ?? 0);
  const mirror = !!opts.mirror;
  const seg = opts.seg ?? 24;

  const depth = R * 0.4;
  // Lowest rim point relative to the dish pivot after pitch (bottom of rim).
  const rimDrop = R * Math.cos(elev) - depth * Math.sin(elev);
  const clear = R * 0.22;
  const pedH = Math.max(R * 1.1, rimDrop + clear);
  const baseH = R * 0.08;
  const pedR = R * 0.11;
  const headR = R * 0.16;
  const headH = R * 0.12;

  // Deck pad + pedestal (built along Z, stood up with -90° X).
  const pad = concat(
    offsetZ(cdrum(R * 0.28, baseH, 12, R * 0.04), baseH / 2),
    offsetZ(drum(pedR, pedH, 10), baseH + pedH / 2),
    offsetZ(cdrum(headR, headH, 12, R * 0.03), baseH + pedH + headH / 2),
  );
  b.add({ structure: pad }, { p, r: [-Math.PI / 2, 0, 0], mirror }, 'dish-mount');

  // Pivot on top of the head — rim clears the deck by construction.
  const pivot = [p[0], p[1] + baseH + pedH + headH * 0.35, p[2]];
  const dishRot = [-elev, yaw, roll];

  const bowl = dishBowl(R, seg, depth);
  const feed = dishFeed(R, depth, seg);
  const stub = offsetZ(drum(R * 0.07, R * 0.22, 8), -R * 0.08);
  const yoke = yokeArms(R);

  b.add(
    { accent2: bowl, structure: concat(feed, stub, yoke) },
    { p: pivot, r: dishRot, mirror },
    'dish',
  );
}

/**
 * Revolve a closed (r, z) meridian about +Z.
 * Profile must run CCW around the solid so front faces point outward.
 */
function revolve(profile, seg) {
  const n = profile.length;
  const rings = [];
  for (let i = 0; i < n; i++) {
    const { r, z } = profile[i];
    const ring = [];
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2 + Math.PI / seg;
      ring.push([Math.cos(a) * r, Math.sin(a) * r, z]);
    }
    rings.push(ring);
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const A = rings[i];
    const B = rings[(i + 1) % n];
    // Skip zero-area bands (e.g. repeated hub point).
    if (almostSameRing(A, B)) continue;
    for (let k = 0; k < seg; k++) {
      const k2 = (k + 1) % seg;
      quad(out, A[k], A[k2], B[k2], B[k]);
    }
  }
  return out;
}

function almostSameRing(a, b) {
  let dr = 0, dz = 0;
  for (let i = 0; i < a.length; i++) {
    dr = Math.max(dr, Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]));
    dz = Math.max(dz, Math.abs(a[i][2] - b[i][2]));
  }
  return dr < 1e-9 && dz < 1e-9;
}

/** Closed shell: outer back → rim lip → inner face → hub plate. */
function dishBowl(R, seg, depth) {
  const th = R * 0.05;
  const lip = R * 0.055;
  const hub = R * 0.13;
  // CCW around the metal in the (r, z) half-plane (solid to the left).
  const profile = [
    { r: 0, z: -th },
    { r: hub, z: -th },
    { r: R * 0.4, z: depth * 0.1 },
    { r: R * 0.75, z: depth * 0.45 },
    { r: R * 0.97, z: depth * 0.85 },
    { r: R + lip * 0.2, z: depth + lip * 0.2 },
    { r: R + lip, z: depth + lip * 0.55 },
    { r: R + lip * 0.25, z: depth + lip },
    { r: R * 0.92, z: depth * 0.8 },
    { r: R * 0.55, z: depth * 0.4 },
    { r: R * 0.22, z: depth * 0.12 },
    { r: hub, z: th * 0.7 },
    { r: 0, z: th * 0.7 },
  ];
  return revolve(profile, seg);
}

/** Central feed horn on a strut from the hub toward the focus. */
function dishFeed(R, depth, seg) {
  const focus = depth * 0.72;
  const strut = offsetZ(drum(R * 0.028, focus, 6), focus / 2);

  const vaneL = focus * 0.55;
  const vane = drum(R * 0.012, vaneL, 4, { ry: 0.35 });
  const vanes = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    vanes.push(offset(vane, [
      Math.cos(a) * R * 0.1,
      Math.sin(a) * R * 0.1,
      vaneL / 2 + R * 0.02,
    ]));
  }

  const hornLen = R * 0.16;
  const horn = offsetZ(
    drum(R * 0.035, hornLen, Math.max(8, seg >> 1), { r2: R * 0.09, capStart: true, capEnd: false }),
    focus + hornLen * 0.15,
  );
  const tip = offsetZ(drum(R * 0.04, R * 0.04, 8), focus + hornLen * 0.35);
  return concat(strut, ...vanes, horn, tip);
}

/** Fork arms behind the hub that seat against the mount head. */
function yokeArms(R) {
  const armR = R * 0.035;
  const armLen = R * 0.35;
  const arm = drum(armR, armLen, 6);
  const y = R * 0.18;
  const z = -R * 0.12;
  return concat(
    offset(arm, [0, y, z - armLen * 0.15]),
    offset(arm, [0, -y, z - armLen * 0.15]),
    offsetZ(cdrum(R * 0.1, R * 0.08, 10, R * 0.02), -R * 0.18),
  );
}
