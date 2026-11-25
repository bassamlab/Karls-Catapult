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
 * Minimal SVG plotting for the workshop (replaces matplotlib / utilities.py).
 *
 * Plot.render(spec) returns an <svg> element.
 * spec = {
 *   title, xlabel, ylabel,
 *   xlim: [lo, hi], ylim: [lo, hi],   // optional, auto otherwise
 *   scene: true,                       // draw catapult, ground and castle
 *   series: [{ type: 'line'|'scatter'|'bar'|'arrow', x: [], y: [], label, role, dashed }]
 * }
 * role picks the colour: truth | obs | est | pred | init | c0..c5
 */
(function (root) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const W = 720, H = 380;
  const M = { top: 40, right: 20, bottom: 48, left: 60 };

  function el(name, attrs = {}, parent) {
    const e = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  }

  function niceStep(span, target) {
    const raw = span / target;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const r = raw / mag;
    return (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
  }

  function ticks(lo, hi, target) {
    const step = niceStep(hi - lo, target);
    const out = [];
    for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) {
      out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    }
    return { values: out, step };
  }

  function fmtTick(v, step) {
    const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    return v.toFixed(Math.min(d, 6));
  }

  function extent(series, key, includeZero) {
    let lo = Infinity, hi = -Infinity;
    for (const s of series) {
      for (const v of s[key]) {
        if (Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
      }
      if (s.type === 'arrow' && key === 'x') for (let i = 0; i < s.x.length; i++) { const e = s.x[i] + s.u[i]; lo = Math.min(lo, e); hi = Math.max(hi, e); }
      if (s.type === 'arrow' && key === 'y') for (let i = 0; i < s.y.length; i++) { const e = s.y[i] + s.v[i]; lo = Math.min(lo, e); hi = Math.max(hi, e); }
    }
    if (includeZero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    if (!Number.isFinite(lo)) return [0, 1];
    if (lo === hi) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.05;
    return [includeZero && lo === 0 ? 0 : lo - pad, hi + pad];
  }

  /** Reduce very long series to a drawable number of points. */
  function thin(xs, ys, maxPts = 3000) {
    if (xs.length <= maxPts) return [xs, ys];
    const step = Math.ceil(xs.length / maxPts);
    const ox = [], oy = [];
    for (let i = 0; i < xs.length; i += step) { ox.push(xs[i]); oy.push(ys[i]); }
    ox.push(xs[xs.length - 1]); oy.push(ys[ys.length - 1]);
    return [ox, oy];
  }

  let clipCounter = 0;

  function render(spec) {
    const series = spec.series || [];
    const hasBars = series.some((s) => s.type === 'bar');
    const xlim = spec.xlim || extent(series, 'x', false);
    const ylim = spec.ylim || extent(series, 'y', hasBars);

    const pw = W - M.left - M.right, ph = H - M.top - M.bottom;
    const sx = (x) => M.left + ((x - xlim[0]) / (xlim[1] - xlim[0])) * pw;
    const sy = (y) => M.top + ph - ((y - ylim[0]) / (ylim[1] - ylim[0])) * ph;

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': spec.title || 'plot' });
    const clipId = `clip${++clipCounter}`;
    el('rect', { x: M.left, y: M.top, width: pw, height: ph }, el('clipPath', { id: clipId }, el('defs', {}, svg)));

    // title
    if (spec.title) el('text', { x: M.left, y: 22, class: 'c-title' }, svg).textContent = spec.title;

    // grid + ticks
    const gx = ticks(xlim[0], xlim[1], 10), gy = ticks(ylim[0], ylim[1], 6);
    const grid = el('g', { class: 'c-grid' }, svg);
    const axis = el('g', { class: 'c-axis' }, svg);
    gx.values.forEach((v) => {
      el('line', { x1: sx(v), x2: sx(v), y1: M.top, y2: M.top + ph }, grid);
      el('text', { x: sx(v), y: M.top + ph + 18, 'text-anchor': 'middle' }, axis).textContent = fmtTick(v, gx.step);
    });
    gy.values.forEach((v) => {
      el('line', { x1: M.left, x2: M.left + pw, y1: sy(v), y2: sy(v) }, grid);
      el('text', { x: M.left - 8, y: sy(v) + 4, 'text-anchor': 'end' }, axis).textContent = fmtTick(v, gy.step);
    });
    el('rect', { x: M.left, y: M.top, width: pw, height: ph, class: 'c-frame' }, svg);
    if (spec.xlabel) el('text', { x: M.left + pw / 2, y: H - 8, 'text-anchor': 'middle', class: 'c-label' }, svg).textContent = spec.xlabel;
    if (spec.ylabel) el('text', { x: 16, y: M.top + ph / 2, 'text-anchor': 'middle', class: 'c-label', transform: `rotate(-90 16 ${M.top + ph / 2})` }, svg).textContent = spec.ylabel;

    const plot = el('g', { 'clip-path': `url(#${clipId})` }, svg);

    if (spec.scene) drawScene(plot, sx, sy);

    // bars: grouped side by side
    const barSeries = series.filter((s) => s.type === 'bar');
    if (barSeries.length) {
      let minGap = Infinity;
      barSeries.forEach((s) => { for (let i = 1; i < s.x.length; i++) minGap = Math.min(minGap, Math.abs(s.x[i] - s.x[i - 1]) || Infinity); });
      if (!Number.isFinite(minGap)) minGap = (xlim[1] - xlim[0]) / 20;
      const groupW = Math.max(1, (sx(xlim[0] + minGap) - sx(xlim[0])) * 0.8);
      const bw = groupW / barSeries.length;
      barSeries.forEach((s, j) => {
        const g = el('g', { class: `s-${s.role} s-bar` }, plot);
        s.x.forEach((x, i) => {
          const y = s.y[i];
          if (!Number.isFinite(x) || !Number.isFinite(y)) return;
          const x0 = sx(x) - groupW / 2 + j * bw;
          const top = Math.min(sy(y), sy(0)), h = Math.abs(sy(y) - sy(0));
          el('rect', { x: x0, y: top, width: Math.max(bw - 0.5, 0.8), height: h }, g);
        });
      });
    }

    for (const s of series) {
      if (s.type === 'line') {
        const [xs, ys] = thin(s.x, s.y);
        let d = '', pen = false;
        for (let i = 0; i < xs.length; i++) {
          if (!Number.isFinite(xs[i]) || !Number.isFinite(ys[i])) { pen = false; continue; }
          d += `${pen ? 'L' : 'M'}${sx(xs[i]).toFixed(1)},${sy(ys[i]).toFixed(1)}`;
          pen = true;
        }
        el('path', { d, class: `s-${s.role} s-line${s.dashed ? ' s-dashed' : ''}` }, plot);
      } else if (s.type === 'scatter') {
        const g = el('g', { class: `s-${s.role} s-scatter` }, plot);
        const [xs, ys] = thin(s.x, s.y, 2000);
        xs.forEach((x, i) => {
          if (Number.isFinite(x) && Number.isFinite(ys[i])) el('circle', { cx: sx(x), cy: sy(ys[i]), r: s.r || 3.2 }, g);
        });
      } else if (s.type === 'arrow') {
        const g = el('g', { class: `s-${s.role} s-arrow` }, plot);
        s.x.forEach((x, i) => {
          const x1 = sx(x), y1 = sy(s.y[i]), x2 = sx(x + s.u[i]), y2 = sy(s.y[i] + s.v[i]);
          const a = Math.atan2(y2 - y1, x2 - x1), L = 9;
          el('line', { x1, y1, x2, y2 }, g);
          el('path', { d: `M${x2},${y2}L${x2 - L * Math.cos(a - 0.4)},${y2 - L * Math.sin(a - 0.4)}L${x2 - L * Math.cos(a + 0.4)},${y2 - L * Math.sin(a + 0.4)}Z` }, g);
        });
      }
    }

    drawLegend(svg, series.filter((s) => s.label), M.left + pw - 8, M.top + 8);
    return svg;
  }

  function drawLegend(svg, items, right, top) {
    if (!items.length) return;
    const lh = 18, w = 12 + Math.max(...items.map((s) => s.label.length)) * 6.6 + 34;
    const g = el('g', { class: 'c-legend' }, svg);
    el('rect', { x: right - w, y: top, width: w, height: items.length * lh + 10, rx: 4 }, g);
    items.forEach((s, i) => {
      const y = top + 14 + i * lh, x = right - w + 10;
      const k = el('g', { class: `s-${s.role} s-${s.type}${s.dashed ? ' s-dashed' : ''}` }, g);
      if (s.type === 'scatter') el('circle', { cx: x + 9, cy: y - 4, r: 3.5 }, k);
      else if (s.type === 'bar') el('rect', { x: x + 3, y: y - 9, width: 12, height: 10 }, k);
      else el('line', { x1: x, x2: x + 18, y1: y - 4, y2: y - 4 }, k);
      el('text', { x: x + 26, y }, g).textContent = s.label;
    });
  }

  /** Decoration: ground, Karl's catapult at the origin and the castle at the far end. */
  function drawScene(g, sx, sy) {
    const d = el('g', { class: 'scene' }, g);
    el('rect', { x: sx(-5), y: sy(0), width: sx(40) - sx(-5), height: 60, class: 'scene-ground' }, d);
    // castle wall around x = 20 … 21.6
    const c = el('g', { class: 'scene-castle' }, d);
    const bx = 20.2, bw = 1.6, bh = 3.2;
    el('rect', { x: sx(bx), y: sy(bh), width: sx(bx + bw) - sx(bx), height: sy(0) - sy(bh) }, c);
    for (let i = 0; i < 4; i++) {
      const x = bx + i * (bw / 3.5);
      el('rect', { x: sx(x), y: sy(bh + 0.35), width: sx(x + bw / 7) - sx(x), height: sy(bh) - sy(bh + 0.35) }, c);
    }
    el('path', { d: `M${sx(bx + 0.55)},${sy(0)}V${sy(0.9)}A${(sx(bx + 1.05) - sx(bx + 0.55)) / 2},${(sx(bx + 1.05) - sx(bx + 0.55)) / 2} 0 0 1 ${sx(bx + 1.05)},${sy(0.9)}V${sy(0)}Z`, class: 'scene-gate' }, c);
    // catapult
    const k = el('g', { class: 'scene-catapult' }, d);
    el('rect', { x: sx(-0.7), y: sy(0.25), width: sx(0.7) - sx(-0.7), height: sy(0) - sy(0.25), rx: 2 }, k);
    el('line', { x1: sx(0.4), y1: sy(0.2), x2: sx(-0.45), y2: sy(1.0) }, k);
  }

  root.Plot = { render };
})(globalThis);
