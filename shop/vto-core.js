// Shared face geometry for the try-on and the fitting page.
// P(i) returns a MediaPipe face landmark in canvas pixels {x, y, z} (z on the same scale as x).
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const mul = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const len = (a) => Math.hypot(a.x, a.y, a.z);
export const unit = (a) => mul(a, 1 / (len(a) || 1));
export const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export const IRIS_MM = 11.7;                    // horizontal visible iris diameter, very consistent across adults
export const OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
export const EYE_R = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
export const EYE_L = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];

// Head axes: ex = screen-left to screen-right across the eyes, ey = up the face, n = out of the face towards the camera.
// M = MediaPipe's facial transformation matrix (column-major 4x4) when available: a rigid fit of the whole face, far
// steadier than two eye corners (whose depth MediaPipe underestimates, which made turned heads read as nearly frontal).
// mirror = the canvas shows the camera mirrored.
export function headPose(P, M, mirror) {
  const a = P(33), b = P(263), [L, R] = a.x < b.x ? [a, b] : [b, a];
  let ex, ey, n;
  const up = sub(P(10), P(152));
  if (M && M.length >= 12) {
    const cv = (i) => unit({ x: (mirror ? -1 : 1) * M[i], y: -M[i + 1], z: -M[i + 2] });   // camera (y up, z to viewer) -> canvas
    ex = cv(0); ey = cv(4); n = cv(8);
    if (dot(ex, sub(R, L)) < 0) ex = mul(ex, -1);
    if (dot(ey, up) < 0) ey = mul(ey, -1);
    if (n.z > 0) n = mul(n, -1);
  } else {
    ex = unit(sub(R, L));
    ey = unit(sub(up, mul(ex, dot(up, ex))));
    n = unit(cross(ex, ey)); if (n.z > 0) n = mul(n, -1);            // MediaPipe z: smaller = closer to the camera
  }
  const yaw = Math.asin(Math.max(-1, Math.min(1, ex.z))), pitch = Math.asin(Math.max(-1, Math.min(1, ey.z)));
  // iris = the ruler; its width foreshortens as the head turns and its height as it nods, so undo that
  const hR = d2(P(469), P(471)), vR = d2(P(470), P(472)), hL = d2(P(474), P(476)), vL = d2(P(475), P(477));
  const cy = Math.max(.55, Math.cos(yaw)), cp = Math.max(.55, Math.cos(pitch));
  const irisPx = ((hR + hL) / 2 / cy + (vR + vL) / 2 / cp) / 2;
  const mm = irisPx / IRIS_MM;                                         // canvas px per mm at the eyes
  return { ex, ey, n, mm, irisPx, pm: mul(add(P(468), P(473)), .5), yaw, roll: Math.atan2(ex.y, ex.x), pitch };
}

// Where a bridge of width `w` mm rests on this nose: the nose's width is read at four heights down its sides
// (landmark pairs found on real faces), and the frame sits where the nose is as wide as the bridge.
const NOSE = [[193, 417], [245, 465], [188, 412], [114, 343]];
export function noseSeat(P, pose, w) {
  const { ex, ey, mm } = pose, top = P(168);
  const pts = NOSE.map(([i, j]) => { const a = P(i), b = P(j); return { y: -dot(sub(mul(add(a, b), .5), top), ey) / mm, w: Math.abs(dot(sub(b, a), ex)) / mm }; })
    .sort((p, q) => p.y - q.y);
  let y = pts[pts.length - 1].y;
  if (w <= pts[0].w) y = pts[0].y;
  else for (let i = 1; i < pts.length; i++) if (w <= pts[i].w) { const p = pts[i - 1], q = pts[i]; y = p.y + (q.y - p.y) * (w - p.w) / ((q.w - p.w) || 1); break; }
  return Math.max(0, Math.min(16, y));                                    // mm below the top of the nose (landmark 168)
}

// Place a frame photo (vto.json entry f) on the face. Returns the canvas transform, a mapper from photo px to canvas,
// and to3 (photo px -> canvas-space 3D point) for the temples.
// Size: lens-centre distance = eye size + bridge. Across: the middle of the four eye corners (fixed to the head; the pupils
// move when someone turned away still looks at the screen). Height: pupils ~2 mm above the lens centre, as an optician fits
// it. Depth: the eye corners sit ~10 mm behind the cornea and the lens ~12 mm in front of it, so the front is ~22 mm ahead.
export function seat(f, P, pose) {
  const { ex, ey, n, mm } = pose;
  const boxW = ((f.boxes.r[2] - f.boxes.r[0]) + (f.boxes.l[2] - f.boxes.l[0])) / 2, boxH = ((f.boxes.r[3] - f.boxes.r[1]) + (f.boxes.l[3] - f.boxes.l[1])) / 2;
  const cDist = ((f.boxes.l[0] + f.boxes.l[2]) - (f.boxes.r[0] + f.boxes.r[2])) / 2;
  const k = (f.eye + f.dbl) * mm / (cDist || boxW);                         // canvas px per photo px
  const ax = (f.boxes.r[2] + f.boxes.l[0]) / 2;                           // bridge centre
  const ay = (f.boxes.r[1] + f.boxes.l[1]) / 2 + boxH / 2;                // lens-box centre line
  const E = mul(add(add(P(33), P(133)), add(P(263), P(362))), .25);
  const pm = mul(add(P(468), P(473)), .5);
  const C = add(add(E, mul(ey, dot(sub(pm, E), ey) - 2 * mm)), mul(n, 22 * mm));
  const T = { a: ex.x * k, b: ex.y * k, c: -ey.x * k, d: -ey.y * k };
  T.e = C.x - (T.a * ax + T.c * ay); T.f = C.y - (T.b * ax + T.d * ay);
  const map = (u, v) => ({ x: T.a * u + T.c * v + T.e, y: T.b * u + T.d * v + T.f });
  const to3 = (u, v) => add(C, add(mul(ex, (u - ax) * k), mul(ey, -(v - ay) * k)));
  return { T, map, to3, C, k, boxW, boxH, seatMm: 0 };
}

// The near temple as a 3D segment: from the hinge straight back along the head (~98 mm to the bend over the ear),
// splaying ~4 mm outwards and dropping ~6 mm. Returns canvas points h (hinge), e (ear bend) and the 2D "down" vector
// for 1 mm of the temple's height, or null when neither arm would be visible.
export function temple3(f, fit, pose) {
  const { ex, ey, n, mm } = pose;
  if (!f.hinge) return null;
  const hs = ['r', 'l'].map((s) => ({ s, p: fit.to3(...f.hinge[s]) })).sort((a, b) => a.p.z - b.p.z);  // nearest first
  const { s, p } = hs[0];
  const out = dot(sub(p, fit.C), ex) > 0 ? 1 : -1;
  const e = add(add(add(p, mul(n, -98 * mm)), mul(ey, -6 * mm)), mul(ex, out * 4 * mm));
  return { side: s, h: p, e, down: { x: -ey.x * mm, y: -ey.y * mm } };
}
