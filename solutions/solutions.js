/*
 * Karl's Catapult - a hands-on introduction to state estimation and the Kalman filter.
 *
 * Copyright (C) 2023 Lehrstuhl Informatik 11 - Embedded Software, RWTH Aachen University
 * Copyright (C) 2026 Professorship for Adaptive Behavior of Autonomous Vehicles,
 *                    University of the Bundeswehr Munich
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Lesser General Public License version 3 as published by
 * the Free Software Foundation. It is distributed in the hope that it will be
 * useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the files COPYING and
 * COPYING.LESSER for details.
 *
 * SPDX-License-Identifier: LGPL-3.0-only
 */

/*
 * Sample solutions for the Kalman filter workshop.
 *
 * If this file is present, every task gets a "Show solution" button.
 * Delete this file (or the <script> tag in index.html) before handing the
 * app to participants if you do not want the solutions to be available.
 *
 * Note: solution code must not contain backticks (it is stored in String.raw).
 */
window.WORKSHOP_SOLUTIONS = {
  1: String.raw`// ----- Constants -----
const speed = 14;    // launch speed [m/s]
const g = 9.81;      // gravity [m/s²]
const p0 = [0, 0];   // launch position [m]
const t0 = 0;        // start time [s]

// Landing time and distance for a given launch angle:
// s_y(t) = 0  ->  t = 2 · v0y / g   and   distance = v0x · t
function flightOf(angle) {
  const v = [speed * Math.cos(angle), speed * Math.sin(angle)];
  const tLand = 2 * v[1] / g;
  return { v: v, tLand: tLand, distance: v[0] * tLand };
}

// ----- Search the optimal angle numerically -----
const angles = linspace(deg2rad(1), deg2rad(89), 500);
const distances = angles.map(a => flightOf(a).distance);
const theta = angles[argmax(distances)];

const v0 = flightOf(theta).v;   // initial velocity [m/s]
const tf = flightOf(theta).tLand; // time of landing [s]

// ----- True trajectory -----
const tTrue = linspace(t0, tf, 2001);
const sTrue = tTrue.map(t => [
  p0[0] + v0[0] * t,
  p0[1] + v0[1] * t - 0.5 * g * t * t,
]);

plotLines('Throw distance vs. launch angle',
  [{ x: angles.map(rad2deg), y: distances, label: 'distance' }],
  { xlabel: 'angle θ₀ [°]', ylabel: 'distance [m]' });
plotScene({ title: 'Optimal trajectory', p0, v0, truth: sTrue });

print('Optimal throwing angle: ' + rad2deg(theta).toFixed(2) + '°');
print('Time of landing:        ' + tf.toFixed(2) + ' s');
print('Distance:               ' + sTrue[sTrue.length - 1][0].toFixed(2) + ' m');
`,

  2: String.raw`const dt = 0.1;                    // 10 Hz measurement rate -> 0.1 s
const tObs = range(t0, tf, dt);   // observation times

// The knights' measurements: true position + Gaussian noise
seed(0);                          // same "random" noise on every run
const sigma = 0.3;                // standard deviation of the noise [m]
const sTrueAtObs = sampleAt(tObs, tTrue, sTrue);
const sObs = sTrueAtObs.map(p => [
  p[0] + randn(0, sigma),
  p[1] + randn(0, sigma),
]);

plotScene({ title: 'True trajectory and observations', p0, v0, truth: sTrue, observations: sObs });

// Error of every observation and its mean
const errObs = sObs.map((s, k) => dist(s, sTrueAtObs[k]));
const meanErrObs = mean(errObs);

plotBars('Error of the observations',
  [{ x: tObs, y: errObs, label: 'observation error' }],
  { xlabel: 't [s]', ylabel: 'error [m]' });

print('Mean position error of observations: ' + meanErrObs.toFixed(4) + ' m');
`,

  3: String.raw`// ----- Initial state and covariance -----
const x0 = col([p0[0], p0[1], v0[0], v0[1]]);   // [s_x, s_y, v_x, v_y]ᵀ
const P0 = eye(4);

// ----- Sensor model -----
const H = [[1, 0, 0, 0],
           [0, 1, 0, 0]];                       // we only measure the position
const R = diag([sigma ** 2, sigma ** 2]);       // measurement noise covariance

// ----- Motion model -----
const A = [[1, 0, dt, 0],
           [0, 1, 0, dt],
           [0, 0, 1,  0],
           [0, 0, 0,  1]];
const B = diag([0, 0, 0, dt]);                  // gravity acts on v_y only
const u = col([0, 0, 0, -g]);                   // systematic disturbance: gravity
const G = col([0.5 * dt * dt, 0.5 * dt * dt, dt, dt]);
const Q = scale(mul(G, T(G)), 1);               // process noise covariance

// ----- Kalman filter loop -----
let x = x0, P = P0, time = t0;
const est = [{ t: time, x: x, P: P }];

for (let k = 1; k < tObs.length; k++) {
  // Prediction: what should have happened
  const xPred = add(mul(A, x), mul(B, u));
  const PPred = add(mul(A, P, T(A)), Q);
  time = time + dt;

  // Update: what we saw happen
  const z = col(sObs[k]);
  const K = mul(PPred, T(H), inv(add(mul(H, PPred, T(H)), R)));
  x = add(xPred, mul(K, sub(z, mul(H, xPred))));
  P = mul(sub(eye(4), mul(K, H)), PPred);

  est.push({ t: time, x: x, P: P });
}

const tEst = est.map(e => e.t);
const sEst = est.map(e => [e.x[0][0], e.x[1][0]]);

plotScene({ title: 'Kalman filter estimate', p0, v0, truth: sTrue, observations: sObs, estimate: sEst });

// ----- Error compared to the true trajectory -----
const sTrueAtEst = sampleAt(tEst, tTrue, sTrue);
const errEst = sEst.map((s, k) => dist(s, sTrueAtEst[k]));
const meanErrEst = mean(errEst);

plotBars('Position error: observations vs. Kalman filter', [
  { x: tObs, y: errObs, label: 'observations' },
  { x: tEst, y: errEst, label: 'Kalman filter' },
], { xlabel: 't [s]', ylabel: 'error [m]' });

print('Mean position error of observations: ' + meanErrObs.toFixed(4) + ' m');
print('Mean position error of estimation:   ' + meanErrEst.toFixed(4) + ' m');
`,

  4: String.raw`// Estimated velocity: the last two entries of the state
const vEst = est.map(e => [e.x[2][0], e.x[3][0]]);

// True velocity: v_x = v0x (constant), v_y = v0y - g·t
const vTrue = tEst.map(t => [v0[0], v0[1] - g * t]);

const errVel = vEst.map((v, k) => dist(v, vTrue[k]));
const meanErrVel = mean(errVel);

plotLines('Velocity in x', [
  { x: tEst, y: vTrue.map(v => v[0]), label: 'true v_x' },
  { x: tEst, y: vEst.map(v => v[0]), label: 'estimated v_x', dashed: true },
], { xlabel: 't [s]', ylabel: 'v_x [m/s]' });

plotLines('Velocity in y', [
  { x: tEst, y: vTrue.map(v => v[1]), label: 'true v_y' },
  { x: tEst, y: vEst.map(v => v[1]), label: 'estimated v_y', dashed: true },
], { xlabel: 't [s]', ylabel: 'v_y [m/s]' });

plotBars('Velocity error', [{ x: tEst, y: errVel, label: 'velocity error' }],
  { xlabel: 't [s]', ylabel: 'error [m/s]' });

print('Mean velocity error of estimation: ' + meanErrVel.toFixed(4) + ' m/s = ' + (meanErrVel * 3.6).toFixed(3) + ' km/h');
`,

  5: String.raw`// Observations are only available for the first half of the flight
const tVisible = 0.5 * tf;

let xb = x0, Pb = P0, tb = t0;
const estB = [{ t: tb, x: xb, P: Pb, measured: true }];

// Run until the stone lands (plus a little margin)
while (tb + dt <= tf + 1e-9) {
  // Prediction
  const xPred = add(mul(A, xb), mul(B, u));
  const PPred = add(mul(A, Pb, T(A)), Q);
  tb = tb + dt;
  xb = xPred;
  Pb = PPred;

  // Update only while the stone is visible
  const k = Math.round(tb / dt);
  const visible = tb <= tVisible && k < sObs.length;
  if (visible) {
    const z = col(sObs[k]);
    const K = mul(PPred, T(H), inv(add(mul(H, PPred, T(H)), R)));
    xb = add(xPred, mul(K, sub(z, mul(H, xPred))));
    Pb = mul(sub(eye(4), mul(K, H)), PPred);
  }
  estB.push({ t: tb, x: xb, P: Pb, measured: visible });
}

const sFiltered = estB.filter(e => e.measured).map(e => [e.x[0][0], e.x[1][0]]);
const sPredicted = estB.filter(e => !e.measured).map(e => [e.x[0][0], e.x[1][0]]);
const sObsVisible = sObs.filter((s, k) => tObs[k] <= tVisible);

plotScene({
  title: 'Partial observations: filter, then predict',
  p0, v0, truth: sTrue, observations: sObsVisible,
  estimate: sFiltered, prediction: sPredicted,
});

const tB = estB.map(e => e.t);
const sB = estB.map(e => [e.x[0][0], e.x[1][0]]);
const sTrueAtB = sampleAt(tB, tTrue, sTrue);
const errB = sB.map((s, k) => dist(s, sTrueAtB[k]));
const sigmaB = estB.map(e => Math.sqrt(e.P[0][0] + e.P[1][1]));

plotLines('Error and predicted uncertainty', [
  { x: tB, y: errB, label: 'position error' },
  { x: tB, y: sigmaB, label: 'uncertainty √(P₁₁+P₂₂)', dashed: true },
], { xlabel: 't [s]', ylabel: '[m]' });

const landing = sB[sB.length - 1];
print('Mean position error (filter + prediction): ' + mean(errB).toFixed(4) + ' m');
print('Predicted landing point: x = ' + landing[0].toFixed(2) + ' m  (true: ' + sTrue[sTrue.length - 1][0].toFixed(2) + ' m)');
`,
};
