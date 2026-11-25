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
 * Toolbox for the Kalman filter workshop.
 *
 * Small replacement for the numpy functions used in the original notebook.
 * Conventions:
 *   - A matrix is an array of rows:        [[1, 0], [0, 1]]
 *   - A column vector is an n×1 matrix:     col([1, 2, 3])  ->  [[1], [2], [3]]
 *   - A point / plain vector is a 1D array: [x, y]
 *
 * Everything is attached to the global object so it can be used directly
 * in the task editors.
 */
(function (root) {
  'use strict';

  // ---------- helpers for helpful error messages ----------
  const isNum = (v) => typeof v === 'number';
  const isMat = (v) => Array.isArray(v) && v.length > 0 && Array.isArray(v[0]);

  function describe(v) {
    if (isNum(v)) return `the number ${v}`;
    if (isMat(v)) return `a ${v.length}×${v[0].length} matrix`;
    if (Array.isArray(v)) return `a plain array of length ${v.length} (use col([...]) for a column vector)`;
    return v === undefined ? 'undefined' : v === null ? 'null' : `a ${typeof v}`;
  }

  function requireMat(A, fn, argName) {
    if (!isMat(A)) throw new TypeError(`${fn}(): ${argName} must be a matrix, but got ${describe(A)}.`);
    const c = A[0].length;
    for (let i = 0; i < A.length; i++) {
      if (!Array.isArray(A[i]) || A[i].length !== c) {
        throw new TypeError(`${fn}(): ${argName} has rows of different length.`);
      }
    }
    return A;
  }

  const dims = (A) => `${A.length}×${A[0].length}`;

  // ---------- matrix construction ----------
  function zeros(rows, cols = rows) {
    return Array.from({ length: rows }, () => new Array(cols).fill(0));
  }

  function ones(rows, cols = rows) {
    return Array.from({ length: rows }, () => new Array(cols).fill(1));
  }

  function eye(n) {
    const I = zeros(n, n);
    for (let i = 0; i < n; i++) I[i][i] = 1;
    return I;
  }

  function diag(values) {
    if (!Array.isArray(values)) throw new TypeError(`diag(): expected an array of numbers, got ${describe(values)}.`);
    const D = zeros(values.length, values.length);
    values.forEach((v, i) => { D[i][i] = v; });
    return D;
  }

  function col(values) {
    if (!Array.isArray(values) || isMat(values)) throw new TypeError(`col(): expected a plain array like [1, 2, 3], got ${describe(values)}.`);
    return values.map((v) => [v]);
  }

  /** Flattens a column/row matrix (or returns a copy of a plain array). */
  function flat(A, fn = 'flat', argName = 'the argument') {
    if (isMat(A)) return A.flat();
    if (Array.isArray(A)) return A.slice();
    throw new TypeError(`${fn}(): ${argName} must be an array or column vector, but got ${describe(A)}.`);
  }

  // ---------- matrix arithmetic ----------
  function T(A) {
    requireMat(A, 'T', 'the argument');
    return A[0].map((_, j) => A.map((row) => row[j]));
  }

  function mul2(A, B) {
    if (isNum(A) && isNum(B)) return A * B;
    if (isNum(A)) return scale(B, A);
    if (isNum(B)) return scale(A, B);
    requireMat(A, 'mul', 'left operand');
    requireMat(B, 'mul', 'right operand');
    if (A[0].length !== B.length) {
      throw new RangeError(`mul(): cannot multiply ${dims(A)} by ${dims(B)} (inner dimensions ${A[0].length} ≠ ${B.length}).`);
    }
    const n = A.length, m = B[0].length, k = B.length;
    const C = zeros(n, m);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        let s = 0;
        for (let l = 0; l < k; l++) s += A[i][l] * B[l][j];
        C[i][j] = s;
      }
    }
    return C;
  }

  /** Matrix product of all arguments: mul(A, P, T(A)). Numbers act as scalars. */
  function mul(...args) {
    if (args.length < 2) throw new TypeError('mul(): needs at least two arguments.');
    return args.reduce((acc, x) => mul2(acc, x));
  }

  function elementwise(fn, name, A, B) {
    if (isNum(A) && isNum(B)) return fn(A, B);
    if (isNum(A)) return requireMat(B, name, 'right operand').map((r) => r.map((b) => fn(A, b)));
    if (isNum(B)) return requireMat(A, name, 'left operand').map((r) => r.map((a) => fn(a, B)));
    requireMat(A, name, 'left operand');
    requireMat(B, name, 'right operand');
    if (A.length !== B.length || A[0].length !== B[0].length) {
      throw new RangeError(`${name}(): shapes do not match (${dims(A)} vs ${dims(B)}).`);
    }
    return A.map((row, i) => row.map((a, j) => fn(a, B[i][j])));
  }

  /** Element-wise sum of all arguments: add(A, B, C). */
  function add(...args) {
    if (args.length < 2) throw new TypeError('add(): needs at least two arguments.');
    return args.reduce((acc, x) => elementwise((a, b) => a + b, 'add', acc, x));
  }

  /** Element-wise difference A - B. */
  function sub(A, B) {
    return elementwise((a, b) => a - b, 'sub', A, B);
  }

  function scale(A, k) {
    if (!isNum(k)) throw new TypeError(`scale(): the factor must be a number, got ${describe(k)}.`);
    return requireMat(A, 'scale', 'the matrix').map((r) => r.map((a) => a * k));
  }

  /** Inverse of a square matrix (Gauss–Jordan elimination with partial pivoting). */
  function inv(A) {
    requireMat(A, 'inv', 'the argument');
    const n = A.length;
    if (A[0].length !== n) throw new RangeError(`inv(): matrix must be square, got ${dims(A)}.`);
    const M = A.map((row, i) => [...row, ...eye(n)[i]]);
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) throw new RangeError('inv(): matrix is singular (not invertible).');
      [M[c], M[p]] = [M[p], M[c]];
      const piv = M[c][c];
      for (let j = 0; j < 2 * n; j++) M[c][j] /= piv;
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r][c];
        if (f !== 0) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j];
      }
    }
    return M.map((row) => row.slice(n));
  }

  // ---------- arrays ----------
  /** Like numpy.arange: [start, start+step, ...) excluding stop. */
  function range(start, stop, step = 1) {
    if (stop === undefined) { stop = start; start = 0; }
    if (!(step > 0)) throw new RangeError('range(): step must be > 0.');
    const n = Math.max(0, Math.ceil((stop - start) / step - 1e-9));
    if (n > 5e6) throw new RangeError(`range(): would create ${n} elements — use a larger step.`);
    return Array.from({ length: n }, (_, i) => start + i * step);
  }

  /** Like numpy.linspace: n evenly spaced values from a to b (inclusive). */
  function linspace(a, b, n) {
    if (n === 1) return [a];
    return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
  }

  /** Linear interpolation like numpy.interp. x may be a number or an array. */
  function interp(x, xp, fp) {
    if (Array.isArray(x)) return x.map((v) => interp(v, xp, fp));
    const n = xp.length;
    if (n === 0) throw new RangeError('interp(): xp is empty.');
    if (x <= xp[0]) return fp[0];
    if (x >= xp[n - 1]) return fp[n - 1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xp[mid] <= x) lo = mid; else hi = mid;
    }
    const w = (x - xp[lo]) / (xp[hi] - xp[lo]);
    return fp[lo] + w * (fp[hi] - fp[lo]);
  }

  /**
   * Samples a trajectory (array of points) at new times.
   * sampleAt(tQuery, tRef, points) -> points at tQuery (linear interpolation per component).
   */
  function sampleAt(tQuery, tRef, points) {
    if (!Array.isArray(points) || !Array.isArray(points[0])) {
      throw new TypeError('sampleAt(): points must be an array of [x, y] points.');
    }
    if (points.length !== tRef.length) {
      throw new RangeError(`sampleAt(): tRef has ${tRef.length} entries but points has ${points.length}.`);
    }
    const d = points[0].length;
    const comps = Array.from({ length: d }, (_, j) => points.map((p) => p[j]));
    const one = (t) => comps.map((c) => interp(t, tRef, c));
    return Array.isArray(tQuery) ? tQuery.map(one) : one(tQuery);
  }

  /** Euclidean length of a vector (plain array or column vector). */
  function norm(v) {
    return Math.sqrt(flat(v, 'norm').reduce((s, x) => s + x * x, 0));
  }

  /** Euclidean distance between two points/vectors. */
  function dist(a, b) {
    const A = flat(a, 'dist', 'the first point'), B = flat(b, 'dist', 'the second point');
    if (A.length !== B.length) throw new RangeError(`dist(): length mismatch (${A.length} vs ${B.length}).`);
    return Math.sqrt(A.reduce((s, x, i) => s + (x - B[i]) ** 2, 0));
  }

  const sum = (arr) => arr.reduce((s, x) => s + x, 0);
  function mean(arr) {
    if (!Array.isArray(arr) || arr.length === 0) throw new RangeError(`mean(): expected a non-empty array, got ${describe(arr)}.`);
    return sum(arr) / arr.length;
  }
  const max = (arr) => arr.reduce((m, x) => (x > m ? x : m), -Infinity);
  const min = (arr) => arr.reduce((m, x) => (x < m ? x : m), Infinity);
  function argmax(arr) {
    let k = 0;
    for (let i = 1; i < arr.length; i++) if (arr[i] > arr[k]) k = i;
    return k;
  }

  const deg2rad = (d) => (d * Math.PI) / 180;
  const rad2deg = (r) => (r * 180) / Math.PI;

  // ---------- reproducible random numbers ----------
  let state = 0x9e3779b9;
  function seed(s) { state = (Math.floor(s) ^ 0x9e3779b9) >>> 0; }
  /** Uniform random number in [0, 1) (seedable, mulberry32). */
  function rand() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** Normally distributed random number with mean mu and standard deviation sigma. */
  function randn(mu = 0, sigma = 1) {
    let u = 0;
    while (u === 0) u = rand();
    const v = rand();
    return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // ---------- pretty printing ----------
  function fmtNum(x) {
    if (!isNum(x)) return String(x);
    if (Number.isInteger(x)) return String(x);
    const a = Math.abs(x);
    if (a !== 0 && (a < 1e-4 || a >= 1e6)) return x.toExponential(3);
    return String(+x.toFixed(4));
  }

  function format(v) {
    if (isNum(v)) return fmtNum(v);
    if (isMat(v)) {
      const cells = v.map((r) => r.map(fmtNum));
      const w = Math.max(...cells.flat().map((s) => s.length));
      return cells.map((r, i) => {
        const open = v.length === 1 ? '[' : i === 0 ? '⎡' : i === v.length - 1 ? '⎣' : '⎢';
        const close = v.length === 1 ? ']' : i === 0 ? '⎤' : i === v.length - 1 ? '⎦' : '⎥';
        return `${open} ${r.map((s) => s.padStart(w)).join('  ')} ${close}`;
      }).join('\n');
    }
    if (Array.isArray(v)) {
      const shown = v.length > 12 ? [...v.slice(0, 6).map(format), '…', ...v.slice(-3).map(format)] : v.map(format);
      return `[${shown.join(', ')}]` + (v.length > 12 ? `  (${v.length} items)` : '');
    }
    if (v && typeof v === 'object') {
      try { return JSON.stringify(v); } catch (e) { return String(v); }
    }
    return String(v);
  }

  root.TOOLBOX_NAMES = ['zeros', 'ones', 'eye', 'diag', 'col', 'flat', 'T', 'mul', 'add', 'sub', 'scale', 'inv',
    'range', 'linspace', 'interp', 'sampleAt', 'norm', 'dist', 'sum', 'mean', 'max', 'min', 'argmax',
    'deg2rad', 'rad2deg', 'seed', 'rand', 'randn', 'print', 'plotScene', 'plotLines', 'plotBars'];

  Object.assign(root, {
    zeros, ones, eye, diag, col, flat,
    T, mul, add, sub, scale, inv,
    range, linspace, interp, sampleAt,
    norm, dist, sum, mean, max, min, argmax,
    deg2rad, rad2deg, seed, rand, randn,
    format,
  });
})(globalThis);
