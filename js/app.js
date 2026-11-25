/*
 * Workshop app: wires the task sections in index.html to editors, runs the
 * participants' code and renders output, plots and automatic checks.
 *
 * All tasks share one scope (like notebook cells): running Task n executes
 * Tasks 1..n in order, so variables from earlier tasks are available later.
 */
(function () {
  'use strict';

  const STORE = 'kf-workshop.v1.';
  const store = {
    get(k) { try { return localStorage.getItem(STORE + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(STORE + k, v); } catch (e) { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem(STORE + k); } catch (e) { /* storage unavailable */ } },
  };

  // ------------------------------------------------------------------
  // Automatic checks per task. `v` holds the variables named in `vars`.
  // ------------------------------------------------------------------
  const finite = (x) => typeof x === 'number' && Number.isFinite(x);
  const isPoints = (a) => Array.isArray(a) && a.length > 0 && a.every((p) => Array.isArray(p) && p.length === 2 && p.every(finite));

  const CHECKS = {
    trajectory: {
      vars: ['theta', 'tf', 'v0', 'g', 'sTrue'],
      run(v) {
        const out = [];
        const deg = finite(v.theta) ? rad2deg(v.theta) : NaN;
        out.push(Math.abs(deg - 45) < 1
          ? [true, `Launch angle θ₀ = ${deg.toFixed(2)}° gives the maximum distance.`]
          : [false, finite(deg) ? `θ₀ = ${deg.toFixed(2)}° — Karl can throw further with another angle.` : 'theta is not a number.']);
        const tLand = finite(v.theta) && Array.isArray(v.v0) && finite(v.g) ? (2 * v.v0[1]) / v.g : NaN;
        out.push(finite(v.tf) && Math.abs(v.tf - tLand) < 0.02
          ? [true, `Time of landing t_f = ${v.tf.toFixed(2)} s is consistent with θ₀.`]
          : [false, 'tf is not the time at which the stone lands (s_y(t_f) = 0).']);
        const ok = isPoints(v.sTrue) && v.sTrue.some((p) => p[0] !== 0 || p[1] !== 0);
        const last = ok ? v.sTrue[v.sTrue.length - 1] : null;
        out.push(ok && Math.abs(last[1]) < 0.05 && last[0] > 1
          ? [true, `True trajectory ends on the ground at x = ${last[0].toFixed(2)} m.`]
          : [false, 'sTrue should be a list of [x, y] points that ends on the ground (y = 0).']);
        return out;
      },
    },
    observations: {
      vars: ['tObs', 'sObs', 'sTrueAtObs', 'errObs', 'meanErrObs', 'tf'],
      run(v) {
        const out = [];
        const t = v.tObs;
        const okT = Array.isArray(t) && t.length > 2 && Math.abs((t[1] - t[0]) - 0.1) < 1e-9;
        out.push(okT ? [true, 'Observations at 10 Hz (every 0.1 s).'] : [false, 'tObs should hold times 0.1 s apart (10 Hz).']);
        const okS = isPoints(v.sObs) && Array.isArray(t) && v.sObs.length === t.length;
        let noisy = false;
        if (okS && isPoints(v.sTrueAtObs) && v.sTrueAtObs.length === v.sObs.length) {
          noisy = mean(v.sObs.map((s, k) => dist(s, v.sTrueAtObs[k]))) > 0.02;
        }
        out.push(noisy ? [true, 'The knights\' observations are noisy.'] : [false, okS ? 'sObs equals the true trajectory — the knights are too sober. Add noise.' : 'sObs should contain one [x, y] point per observation time.']);
        const okE = finite(v.meanErrObs) && v.meanErrObs > 0 && Array.isArray(v.errObs) && Math.abs(mean(v.errObs) - v.meanErrObs) < 1e-9;
        out.push(okE ? [true, `Mean observation error: ${v.meanErrObs.toFixed(4)} m.`] : [false, 'meanErrObs should be the mean of errObs (and errObs the distance of each observation to the truth).']);
        return out;
      },
    },
    kalman: {
      vars: ['sEst', 'tObs', 'errEst', 'meanErrEst', 'meanErrObs'],
      run(v) {
        const out = [];
        const moving = isPoints(v.sEst) && v.sEst[v.sEst.length - 1][0] > 1;
        out.push(moving ? [true, 'The filter produces a moving estimate.'] : [false, 'sEst does not move yet — implement the prediction step.']);
        const okE = finite(v.meanErrEst) && v.meanErrEst > 0 && Array.isArray(v.errEst) && Math.abs(mean(v.errEst) - v.meanErrEst) < 1e-9;
        out.push(okE ? [true, `Mean estimation error: ${v.meanErrEst.toFixed(4)} m.`] : [false, 'meanErrEst should be the mean of errEst.']);
        out.push(okE && finite(v.meanErrObs) && v.meanErrEst < v.meanErrObs
          ? [true, `The filter beats the raw observations (${v.meanErrEst.toFixed(3)} m < ${v.meanErrObs.toFixed(3)} m).`]
          : [false, 'The estimate is not yet better than the raw observations — add the update step and tune Q and R.']);
        return out;
      },
    },
    velocity: {
      vars: ['vEst', 'vTrue', 'errVel', 'meanErrVel'],
      run(v) {
        const out = [];
        out.push(isPoints(v.vTrue) && v.vTrue.some((p) => p[1] !== v.vTrue[0][1])
          ? [true, 'True velocity changes over time (gravity acts on v_y).']
          : [false, 'vTrue should contain [v_x, v_y] for every estimation time.']);
        const okE = finite(v.meanErrVel) && v.meanErrVel > 0 && Array.isArray(v.errVel) && Math.abs(mean(v.errVel) - v.meanErrVel) < 1e-9;
        out.push(okE ? [true, `Mean velocity error: ${v.meanErrVel.toFixed(3)} m/s.`] : [false, 'meanErrVel should be the mean of errVel.']);
        out.push(okE && v.meanErrVel < 1
          ? [true, 'Velocity estimated to better than 1 m/s — without ever measuring it.']
          : [false, 'The velocity error is still above 1 m/s.']);
        return out;
      },
    },
  };

  // ------------------------------------------------------------------
  // Task setup
  // ------------------------------------------------------------------
  const sections = Array.from(document.querySelectorAll('section.task'));
  const solutions = window.WORKSHOP_SOLUTIONS || null;

  const tasks = sections.map((sec, i) => {
    const id = sec.dataset.task;
    const starter = dedent(sec.querySelector('script.starter').textContent);
    const card = document.createElement('div');
    card.className = 'cell';
    card.innerHTML = `
      <div class="cell-bar">
        <span class="cell-name">task${i + 1}.js</span>
        <span class="cell-status" aria-live="polite"></span>
        <span class="spacer"></span>
        ${solutions && solutions[id] ? '<button type="button" class="btn ghost" data-act="solution">Show solution</button>' : ''}
        <button type="button" class="btn ghost" data-act="reset">Reset</button>
        <button type="button" class="btn primary" data-act="run" title="Runs Tasks 1–${i + 1} (Ctrl/⌘+Enter)">▶ Run</button>
      </div>
      <div class="cell-editor"></div>
      <div class="cell-out" hidden><div class="out-flow"></div><ul class="checks"></ul></div>`;
    sec.querySelector('.task-body').appendChild(card);

    const task = {
      id, index: i, sec, starter,
      check: CHECKS[sec.dataset.check] || null,
      status: card.querySelector('.cell-status'),
      out: card.querySelector('.cell-out'),
      flow: card.querySelector('.out-flow'),
      checks: card.querySelector('.checks'),
    };
    task.editor = new Editor(card.querySelector('.cell-editor'), {
      value: store.get('task.' + id) ?? starter,
      label: `Code for task ${i + 1}`,
      onChange: (v) => { store.set('task.' + id, v); setStatus(task, 'edited'); },
      onRun: () => run(i),
    });
    card.querySelector('[data-act=run]').addEventListener('click', () => run(i));
    card.querySelector('[data-act=reset]').addEventListener('click', () => {
      if (confirm(`Reset task ${i + 1} to the starter code? (Ctrl/⌘+Z undoes this.)`)) {
        task.editor.setValue(starter);
        store.del('task.' + id);
      }
    });
    const solBtn = card.querySelector('[data-act=solution]');
    if (solBtn) solBtn.addEventListener('click', () => {
      if (confirm(`Replace your code in task ${i + 1} with the sample solution? (Ctrl/⌘+Z undoes this.)`)) {
        task.editor.setValue(solutions[id]);
      }
    });
    return task;
  });

  function dedent(s) {
    const lines = s.replace(/^\s*\n/, '').replace(/\s+$/, '').split('\n');
    const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
    return lines.map((l) => l.slice(ind)).join('\n') + '\n';
  }

  function setStatus(task, kind, text) {
    const labels = { ok: '✓ ran', error: '✗ error', skipped: 'not run', edited: 'edited', done: '★ all checks passed' };
    task.status.className = 'cell-status st-' + kind;
    task.status.textContent = text || labels[kind] || '';
    const dot = document.querySelector(`.progress [data-dot="${task.id}"]`);
    if (dot && kind !== 'edited') dot.className = 'dot st-' + kind;
  }

  // ------------------------------------------------------------------
  // Output API available to participant code
  // ------------------------------------------------------------------
  let current = null;

  function emit(node) {
    if (!current) return;
    current.out.hidden = false;
    current.flow.appendChild(node);
  }

  window.print = function print(...args) {
    const pre = document.createElement('pre');
    pre.className = 'out-text';
    pre.textContent = args.map((a) => (typeof a === 'string' ? a : format(a))).join(' ');
    emit(pre);
  };

  function toXY(points, fn, name) {
    if (!Array.isArray(points)) throw new TypeError(`${fn}(): ${name} must be an array of [x, y] points.`);
    const x = [], y = [];
    points.forEach((p, k) => {
      if (Array.isArray(p) && Array.isArray(p[0])) p = p.map((r) => r[0]); // allow column vectors
      if (!Array.isArray(p) || p.length < 2) throw new TypeError(`${fn}(): ${name}[${k}] is not an [x, y] point.`);
      x.push(+p[0]); y.push(+p[1]);
    });
    return { x, y };
  }

  function figure(spec) {
    const fig = document.createElement('figure');
    fig.className = 'out-fig';
    fig.appendChild(Plot.render(spec));
    emit(fig);
  }

  /** The catapult scene in the x-y plane (replaces the plot_* helpers of utilities.py). */
  window.plotScene = function plotScene({ title = 'Catapult', p0, v0, truth, observations, estimate, prediction } = {}) {
    const series = [];
    if (truth) series.push({ type: 'line', role: 'truth', label: 'true trajectory', ...toXY(truth, 'plotScene', 'truth') });
    if (observations) series.push({ type: 'scatter', role: 'obs', label: 'observations', ...toXY(observations, 'plotScene', 'observations') });
    if (estimate) {
      const s = toXY(estimate, 'plotScene', 'estimate');
      series.push({ type: 'line', role: 'est', dashed: true, label: 'Kalman estimate', ...s });
      series.push({ type: 'scatter', role: 'est', r: 2.4, ...s });
    }
    if (prediction) {
      const s = toXY(prediction, 'plotScene', 'prediction');
      series.push({ type: 'line', role: 'pred', dashed: true, label: 'prediction only', ...s });
      series.push({ type: 'scatter', role: 'pred', r: 2.4, ...s });
    }
    if (p0) {
      const p = toXY([p0], 'plotScene', 'p0');
      if (v0) {
        const v = toXY([v0], 'plotScene', 'v0');
        series.push({ type: 'arrow', role: 'init', x: p.x, y: p.y, u: [v.x[0] * 0.15], v: [v.y[0] * 0.15] });
      }
      series.push({ type: 'scatter', role: 'init', label: 'launch point', r: 5, ...p });
    }
    figure({ title, xlabel: 's_x [m]', ylabel: 's_y [m]', xlim: [-1, 22.5], ylim: [-0.6, 10.5], scene: true, series });
  };

  function generic(type, fn) {
    return function (title, series, opts = {}) {
      if (!Array.isArray(series)) series = [series];
      const list = series.map((s, k) => {
        if (!s || !Array.isArray(s.x) || !Array.isArray(s.y)) throw new TypeError(`${fn}(): series ${k + 1} needs arrays x and y.`);
        if (s.x.length !== s.y.length) throw new RangeError(`${fn}(): series ${k + 1} has ${s.x.length} x-values but ${s.y.length} y-values.`);
        return { type, role: 'c' + (k % 6), label: s.label, dashed: !!s.dashed, x: s.x.map(Number), y: s.y.map(Number) };
      });
      figure({ title, xlabel: opts.xlabel, ylabel: opts.ylabel, xlim: opts.xlim, ylim: opts.ylim, series: list });
    };
  }
  window.plotLines = generic('line', 'plotLines');
  window.plotBars = generic('bar', 'plotBars');

  // ------------------------------------------------------------------
  // Runner
  // ------------------------------------------------------------------
  window.__ws = {
    failure: null,
    enter(i) { current = tasks[i]; },
    done(i, vars) { tasks[i].vars = vars; },
    // Runtime errors are caught inside the generated script: this always gives the
    // real Error object (Safari/Firefox hide details of errors from file:// scripts
    // when they only reach window.onerror, reporting just "Script error.").
    fail(e) { if (!this.failure) this.failure = e; },
  };

  // Stack frames that belong to the app itself (not to participant code).
  const INTERNAL_FRAME = /\/js\/(linalg|plot|app|errors|editor)\.js|solutions\.js|\[native code\]|<anonymous>\)?\s*$/;

  /** First stack frame with a line number that is participant code: { line, col } or null. */
  function userFrame(stack) {
    if (!stack) return null;
    for (const f of String(stack).split('\n')) {
      const m = f.match(/:(\d+):(\d+)\)?\s*$/) || f.match(/:(\d+)\)?\s*$/);
      if (!m || INTERNAL_FRAME.test(f)) continue;
      return { line: +m[1], col: m[2] ? +m[2] : null };
    }
    return null;
  }

  // Browsers count lines of injected scripts differently; measure it once.
  const OFFSET = { stack: 0, syntax: -1 };

  /**
   * Executes source as a classic script and returns the first uncaught error
   * with its line/column inside that script (or null).
   */
  function runScript(source, fileName) {
    let caught = null;
    const onError = (ev) => {
      ev.preventDefault();
      if (caught) return;
      const err = ev.error;
      let line = null, col = null;
      if (!/\/js\/[\w-]+\.js|solutions\.js/.test(ev.filename || '') && ev.lineno) { line = ev.lineno; col = ev.colno || null; }
      let error = err;
      if (!error || typeof error !== 'object') {
        const parts = String(ev.message || 'Error').replace(/^Uncaught /, '').match(/^(\w*Error):\s*([\s\S]*)$/);
        error = { name: parts ? parts[1] : 'Error', message: parts ? parts[2] : String(ev.message) };
      }
      caught = { error: { name: error.name || 'Error', message: String(error.message || '').replace(/Failed to execute '[^']*' on '[^']*': /, '') }, line, col };
    };
    window.addEventListener('error', onError);
    const script = document.createElement('script');
    script.textContent = source;
    try { document.body.appendChild(script); } finally {
      script.remove();
      window.removeEventListener('error', onError);
    }
    return caught;
  }

  /** Compiles (without running) one task's code; returns a syntax failure or null. */
  function syntaxCheck(code) {
    let engineMsg = 'Invalid code';
    try { new Function('"use strict";\n' + code); return null; } catch (e) {
      if (!(e instanceof SyntaxError)) return null;
      engineMsg = e.message;
    }
    // Compile again as a script to learn the line/column of the problem.
    const caught = runScript('(function () { "use strict";\n' + code + '\n});\n//# sourceURL=syntax-check.js', 'syntax-check.js');
    const err = caught && caught.error.message ? caught.error : { name: 'SyntaxError', message: engineMsg };
    const nLines = code.split('\n').length;
    let line = caught && caught.line ? caught.line + OFFSET.syntax : null;
    if (line !== null && (line < 1 || line > nLines)) line = Math.min(Math.max(line, 1), nLines);
    return { error: { name: 'SyntaxError', message: err.message }, line, col: caught ? caught.col : null, syntax: true };
  }

  (function calibrate() {
    // a runtime error thrown on line 3 of an injected script
    __ws.failure = null;
    runScript('(function () { try {\nnull;\n(function () { throw new Error("calibrate"); })();\n} catch (e) { __ws.fail(e); } })();\n//# sourceURL=workshop-tasks.js', 'workshop-tasks.js');
    const fr = __ws.failure && userFrame(__ws.failure.stack);
    if (fr) OFFSET.stack = 3 - fr.line;
    __ws.failure = null;
    // a syntax error on line 3 of the code inside the syntax-check wrapper (wrapper adds 1 line)
    const c = runScript('(function () { "use strict";\nnull;\nnull;\nlet = ;\n});\n//# sourceURL=syntax-check.js', 'syntax-check.js');
    if (c && c.line) OFFSET.syntax = 3 - c.line;
  })();

  function showError(t, failure, upTo) {
    const code = t.editor.value;
    const codeLines = code.split('\n');
    const syntaxIssue = failure.syntax ? ErrorHelp.analyzeSyntax(code) : null;
    // A structural finding (bracket, string, symbol) is more precise than the engine's position.
    let line = failure.line, col = failure.col;
    if (syntaxIssue) { line = syntaxIssue.line; col = syntaxIssue.col; }

    const lineText = line ? codeLines[line - 1] : null;
    const prevCode = line ? codeLines.slice(0, line - 1).join('\n') + '\n' + (lineText || '').slice(0, Math.max(0, (col || 1) - 1)) : '';
    const help = ErrorHelp.explain({
      name: failure.error.name, message: failure.error.message, hasLine: !!line,
      lineText, prevCode, col, task: t.index, ranUpTo: upTo, syntaxIssue,
      tasks: tasks.map((x) => ({ index: x.index, code: x.editor.value })),
    });

    const box = document.createElement('div');
    box.className = 'out-error';
    box.setAttribute('role', 'alert');
    const h = document.createElement('div');
    h.className = 'err-title';
    h.textContent = help.title + (line ? ` — line ${line}` : '');
    box.appendChild(h);

    if (line && lineText !== undefined) {
      const pre = document.createElement('pre');
      pre.className = 'err-code';
      const w = String(line).length;
      const rows = [];
      if (line > 1 && codeLines[line - 2].trim()) rows.push(`${String(line - 1).padStart(w)} │ ${codeLines[line - 2]}`);
      rows.push(`${String(line).padStart(w)} │ ${lineText}`);
      let text = rows.join('\n');
      if (col && col >= 1 && col <= lineText.length + 1) text += `\n${' '.repeat(w)} │ ${' '.repeat(col - 1)}^`;
      pre.textContent = text;
      box.appendChild(pre);
    }

    const p = document.createElement('p');
    p.className = 'err-explain';
    p.textContent = help.explain;
    box.appendChild(p);
    if (!line) {
      const n = document.createElement('p');
      n.className = 'err-explain err-noline';
      n.textContent = `The browser did not say on which line of Task ${t.index + 1} this happened.`;
      box.appendChild(n);
    }

    if (help.fixes.length) {
      const ul = document.createElement('ul');
      ul.className = 'err-fixes';
      help.fixes.forEach((f) => { const li = document.createElement('li'); li.textContent = f; ul.appendChild(li); });
      box.appendChild(ul);
    }

    const foot = document.createElement('div');
    foot.className = 'err-foot';
    if (line) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ghost';
      b.textContent = `Go to line ${line}`;
      b.addEventListener('click', () => t.editor.goToLine(line, col));
      foot.appendChild(b);
    }
    const raw = document.createElement('code');
    raw.className = 'err-raw';
    raw.textContent = help.raw;
    foot.appendChild(raw);
    box.appendChild(foot);

    t.out.hidden = false;
    t.flow.appendChild(box);
    if (line) t.editor.markError(line);
  }

  function run(upTo) {
    const active = tasks.slice(0, upTo + 1);
    tasks.forEach((t) => {
      t.flow.innerHTML = '';
      t.checks.innerHTML = '';
      t.vars = null;
      t.out.hidden = true;
      t.editor.markError(null);
    });

    // 1) Syntax check every task on its own, so an unclosed bracket is
    //    blamed on the task that contains it (not on the end of the script).
    let failure = null;
    for (const t of active) {
      const issue = syntaxCheck(t.editor.value);
      if (issue) { failure = { ...issue, task: t.index }; break; }
    }

    // 2) Run all tasks as one script (shared scope); map error lines back.
    const ranges = [];
    if (!failure) {
      const lines = ['(function () { "use strict"; try {'];
      active.forEach((t, i) => {
        const code = t.editor.value.split('\n');
        const names = t.check ? t.check.vars : [];
        lines.push(`__ws.enter(${i});`);
        ranges.push({ start: lines.length + 1, end: lines.length + code.length });
        lines.push(...code);
        lines.push(`;__ws.done(${i}, {${names.map((n) => `${n}: (() => { try { return ${n}; } catch (e) { return undefined; } })()`).join(', ')}});`);
      });
      lines.push('} catch (e) { __ws.fail(e); } })();', '//# sourceURL=workshop-tasks.js');

      __ws.failure = null;
      let caught = runScript(lines.join('\n'), 'workshop-tasks.js');
      const e = __ws.failure;
      __ws.failure = null;
      if (e) {
        const isErr = e && typeof e === 'object';
        const fr = isErr ? userFrame(e.stack) : null;
        caught = {
          error: { name: (isErr && e.name) || 'Error', message: isErr ? String(e.message) : String(e) },
          line: fr ? fr.line + OFFSET.stack : null,
          col: fr ? fr.col : null,
        };
      }
      if (caught) {
        failure = { error: caught.error, line: null, col: null, task: null };
        if (caught.line != null) {
          const r = ranges.findIndex((x) => caught.line >= x.start && caught.line <= x.end);
          if (r >= 0) { failure.task = r; failure.line = caught.line - ranges[r].start + 1; failure.col = caught.col; }
        }
        if (failure.task === null) failure.task = current ? current.index : active.length - 1;
      }
    }

    let failedAt = null;
    if (failure) {
      failedAt = failure.task;
      showError(tasks[failedAt], failure, upTo);
    }
    current = null;

    active.forEach((t, i) => {
      if (failedAt !== null && i > failedAt) {
        setStatus(t, 'skipped', `not run — fix task ${failedAt + 1} first`);
        return;
      }
      if (failedAt === i) { setStatus(t, 'error'); return; }
      let allOk = true;
      if (t.check && t.vars) {
        let results;
        try { results = t.check.run(t.vars); } catch (e) { results = [[false, 'Could not check the results: ' + e.message]]; }
        results.forEach(([ok, msg]) => {
          const li = document.createElement('li');
          li.className = ok ? 'ok' : 'todo';
          li.textContent = msg;
          t.checks.appendChild(li);
          allOk = allOk && ok;
        });
        t.out.hidden = false;
      }
      setStatus(t, t.check && allOk ? 'done' : 'ok');
    });

    tasks.slice(upTo + 1).forEach((t) => setStatus(t, 'idle', ''));

    const target = failedAt !== null ? tasks[failedAt] : tasks[upTo];
    if (target.out.hidden === false && !isInView(target.out)) {
      target.out.scrollIntoView({ behavior: 'smooth', block: failedAt !== null ? 'center' : 'nearest' });
    }
  }

  function isInView(el) {
    const r = el.getBoundingClientRect();
    return r.top < innerHeight && r.bottom > 0;
  }

  // ------------------------------------------------------------------
  // Header actions
  // ------------------------------------------------------------------
  document.getElementById('run-all').addEventListener('click', () => run(tasks.length - 1));

  document.getElementById('download').addEventListener('click', () => {
    const body = tasks.map((t, i) => `// ===== Task ${i + 1}: ${t.sec.querySelector('h2').textContent.trim()} =====\n${t.editor.value}`).join('\n\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type: 'text/javascript' }));
    a.download = 'kalman-workshop-my-code.js';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  const dlg = document.getElementById('toolbox');
  document.getElementById('open-toolbox').addEventListener('click', () => dlg.showModal());
  dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });

  const themeBtn = document.getElementById('theme');
  const applyTheme = (t) => {
    if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  };
  applyTheme(store.get('theme'));
  themeBtn.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    applyTheme(next);
    store.set('theme', next);
  });

  // progress dots
  const progress = document.querySelector('.progress');
  tasks.forEach((t, i) => {
    const a = document.createElement('a');
    a.href = '#' + t.sec.id;
    a.dataset.dot = t.id;
    a.className = 'dot';
    a.textContent = t.sec.dataset.short || String(i + 1);
    a.title = t.sec.querySelector('h2').textContent.trim();
    progress.appendChild(a);
  });

  // keep editor sizes right when the layout changes
  let rz;
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => tasks.forEach((t) => t.editor.refresh()), 100); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => tasks.forEach((t) => t.editor.refresh()));
})();
