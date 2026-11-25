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
 * Turns JavaScript errors into explanations a workshop participant can act on.
 *
 * ErrorHelp.analyzeSyntax(code)  -> precise issue (unclosed bracket, string,
 *                                   copied math symbol, Python habit) or null
 * ErrorHelp.explain(info)        -> { title, explain, fixes[], raw }
 *
 * Messages of Chrome/Edge, Firefox and Safari are recognised.
 */
(function (root) {
  'use strict';

  // ------------------------------------------------------------------
  // Characters that sneak in when copying formulas from slides or the page
  // ------------------------------------------------------------------
  const SYMBOLS = {
    '·': ['the multiplication dot ·', 'use * for numbers, or mul(A, B) for matrices'],
    '⋅': ['the multiplication dot ⋅', 'use * for numbers, or mul(A, B) for matrices'],
    '∙': ['the multiplication dot ∙', 'use * for numbers, or mul(A, B) for matrices'],
    '×': ['the multiplication sign ×', 'use * for numbers, or mul(A, B) for matrices'],
    '−': ['a typographic minus sign −', 'use the normal minus key -'],
    '–': ['a dash –', 'use the normal minus key -'],
    '—': ['a dash —', 'use the normal minus key -'],
    '²': ['a superscript ²', 'write x ** 2 or x * x'],
    '³': ['a superscript ³', 'write x ** 3'],
    'ᵀ': ['a superscript ᵀ', 'write T(A) for the transpose of A'],
    '⁻': ['a superscript ⁻', 'write inv(A) for the inverse of A'],
    '¹': ['a superscript ¹', 'write inv(A) for the inverse of A'],
    '≤': ['the symbol ≤', 'write <='],
    '≥': ['the symbol ≥', 'write >='],
    '≠': ['the symbol ≠', 'write !=='],
    '√': ['the root sign √', 'write Math.sqrt(x)'],
    '½': ['the fraction ½', 'write 0.5'],
    '‘': ['a curly quote ‘', "use a straight quote '"],
    '’': ['a curly quote ’', "use a straight quote '"],
    '“': ['a curly quote “', 'use a straight quote "'],
    '”': ['a curly quote ”', 'use a straight quote "'],
    ' ': ['an invisible non-breaking space', 'delete it and type a normal space'],
    '@': ['the @ operator (matrix product in Python)', 'write mul(A, B)'],
    '#': ['a # (comment in Python)', 'start comments with // in JavaScript'],
  };

  const OPEN = { '(': ')', '[': ']', '{': '}' };
  const CLOSE = { ')': '(', ']': '[', '}': '{' };
  const BR_NAME = { '(': 'round bracket (', ')': 'round bracket )', '[': 'square bracket [', ']': 'square bracket ]', '{': 'curly brace {', '}': 'curly brace }' };

  /**
   * Walks through the code like the JavaScript tokenizer (strings, comments,
   * template literals, regex literals) and reports the first structural problem.
   */
  function scan(code) {
    const stack = [];            // open brackets: { ch, line, col }
    const tmpl = [];             // stack depth at which a template literal's ${ } started
    let line = 1, col = 0, i = 0;
    let prevSig = '';            // previous significant character (for regex detection)
    const n = code.length;
    const at = (l, c) => ({ line: l, col: c });

    const next = () => {
      const ch = code[i++];
      if (ch === '\n') { line++; col = 0; } else col++;
      return ch;
    };

    while (i < n) {
      const ch = code[i];
      const l = line, c = col + 1;

      // comments
      if (ch === '/' && code[i + 1] === '/') { while (i < n && code[i] !== '\n') next(); continue; }
      if (ch === '/' && code[i + 1] === '*') {
        next(); next();
        while (i < n && !(code[i] === '*' && code[i + 1] === '/')) next();
        if (i >= n) return { kind: 'comment', ...at(l, c), message: `The comment /* started on line ${l} is never closed.`, fix: 'Close it with */ — or use // for a one-line comment.' };
        next(); next();
        continue;
      }

      // strings
      if (ch === '"' || ch === "'") {
        next();
        while (i < n && code[i] !== ch && code[i] !== '\n') { if (code[i] === '\\') next(); next(); }
        if (i >= n || code[i] === '\n') {
          return { kind: 'string', ...at(l, c), message: `The text (string) starting with ${ch} on line ${l} is not closed on the same line.`, fix: `Add the closing ${ch} at the end of the text.` };
        }
        next(); prevSig = 'a';
        continue;
      }

      // template literals, possibly resumed after a ${ ... }
      if (ch === '`' || (ch === '}' && tmpl.length && tmpl[tmpl.length - 1] === stack.length - 1 && stack[stack.length - 1].ch === '${')) {
        if (ch === '}') { stack.pop(); tmpl.pop(); }
        const startL = l, startC = c;
        next();
        let opened = false;
        while (i < n && code[i] !== '`') {
          if (code[i] === '\\') { next(); next(); continue; }
          if (code[i] === '$' && code[i + 1] === '{') {
            const sl = line, sc = col + 1;
            next(); next();
            tmpl.push(stack.length);
            stack.push({ ch: '${', line: sl, col: sc });
            opened = true;
            break;
          }
          next();
        }
        if (opened) { prevSig = '('; continue; }
        if (i >= n) return { kind: 'string', ...at(startL, startC), message: `The template text (backtick \`) starting on line ${startL} is never closed.`, fix: 'Add the closing backtick `.' };
        next(); prevSig = 'a';
        continue;
      }

      // regex literal (heuristic: a / where a value is expected)
      if (ch === '/' && (prevSig === '' || '(,=:[!&|?{};+-*%<>~^'.includes(prevSig))) {
        next();
        let inClass = false;
        while (i < n && code[i] !== '\n') {
          if (code[i] === '\\') { next(); next(); continue; }
          if (code[i] === '[') inClass = true;
          else if (code[i] === ']') inClass = false;
          else if (code[i] === '/' && !inClass) break;
          next();
        }
        if (code[i] === '/') next();
        prevSig = 'a';
        continue;
      }

      if (OPEN[ch]) {
        stack.push({ ch, line: l, col: c });
      } else if (CLOSE[ch]) {
        const top = stack[stack.length - 1];
        if (!top) {
          return { kind: 'bracket', ...at(l, c), message: `Line ${l} has a closing ${BR_NAME[ch]} that closes nothing.`, fix: `Remove it, or add the matching ${CLOSE[ch]} earlier.` };
        }
        const topCh = top.ch === '${' ? '{' : top.ch;
        if (topCh !== CLOSE[ch]) {
          return {
            kind: 'bracket', ...at(l, c),
            message: `The ${BR_NAME[ch]} on line ${l} does not match the ${BR_NAME[topCh]} opened on line ${top.line}.`,
            fix: `Probably a ${OPEN[topCh]} is missing before this point (to close the ${topCh} from line ${top.line}), or this ${ch} should be a ${OPEN[topCh]}.`,
            related: top.line,
          };
        }
        stack.pop();
      } else if (SYMBOLS[ch] && ch !== '#' && ch !== '@') {
        const [what, fix] = SYMBOLS[ch];
        return { kind: 'symbol', ...at(l, c), message: `Line ${l} contains ${what}, which JavaScript does not understand.`, fix: `${fix[0].toUpperCase()}${fix.slice(1)}.` };
      }

      if (!/\s/.test(ch)) prevSig = /[\w$)\]]/.test(ch) ? 'a' : ch;
      next();
    }

    if (stack.length) {
      const top = stack[stack.length - 1];
      const ch = top.ch === '${' ? '{' : top.ch;
      return {
        kind: 'bracket', line: top.line, col: top.col,
        message: `The ${BR_NAME[ch]} opened on line ${top.line} is never closed.`,
        fix: `Add the matching ${OPEN[ch]} where this ${ch === '{' ? 'block' : 'expression'} should end.`,
      };
    }
    return null;
  }

  // ------------------------------------------------------------------
  // Habits from Python / numpy (the original workshop was a notebook)
  // ------------------------------------------------------------------
  const PY_HABITS = [
    [/^\s*for\s*\(?\s*\w+\s+in\s+range\s*\(/, 'This is a Python-style loop.', 'In JavaScript: for (let k = 0; k < n; k++) { … }  or  for (const t of tObs) { … }'],
    [/^\s*for\s+[\w\s,]+\s+in\s+/, 'This is a Python-style loop.', 'In JavaScript: for (let k = 0; k < n; k++) { … }  or  for (const t of tObs) { … }'],
    [/^\s*def\s+\w+/, 'def is Python.', 'In JavaScript: function name(a, b) { … return result; }'],
    [/^\s*(if|for|while|elif|else|def)\b.*:\s*(#.*)?$/, 'A line ending with ":" opens a block in Python, not in JavaScript.', 'Use curly braces: if (condition) { … } else { … }'],
    [/\belif\b/, 'elif is Python.', 'Write else if (…) { … }'],
    [/^\s*#/, '# starts a comment in Python, not in JavaScript.', 'Start comments with //'],
    [/\b(np|numpy)\./, 'numpy is not available here.', 'Use the Toolbox functions instead, e.g. mul, add, T, inv, eye, diag, col, linspace, mean (button at the top right).'],
    [/^\s*(import|from)\s+\w+/, 'Nothing needs to be imported — all Toolbox functions are always available.', 'Delete the import line.'],
    [/\bf(["'])[^"']*\{/, 'f-strings are Python.', "Use 'text ' + value  or a template string `text ${value}` (with backticks)."],
    [/[^\w$]len\s*\(/, 'len() is Python.', 'Use array.length'],
    [/\.append\s*\(/, '.append() is Python.', 'Use array.push(value)'],
    [/[\w\])]\.T\b(?!\s*\()/, 'A.T is numpy. In JavaScript A.T is undefined.', 'Write T(A) for the transpose.'],
    [/\b(True|False|None)\b/, 'True / False / None are Python.', 'Use true / false / null'],
    [/\s(and|or)\s|\bnot\s+[\w(]/, 'and / or / not are Python.', 'Use && (and), || (or), ! (not)'],
    [/[\w\])]\[[^\[\]]*,[^\[\]]*\]/, 'A[i, j] is numpy indexing. In JavaScript A[i, j] silently means A[j].', 'Write A[i][j].'],
    [/\*\*\s*-?\s*1\b/, 'A ** -1 only works for numbers.', 'For a matrix write inv(A).'],
    [/^\s*print\s+[^(]/, 'print without brackets is Python 2.', 'Write print(value)'],
  ];

  function stripComment(text) {
    // remove // comments outside of strings (good enough for hints)
    let q = null;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'" || c === '`') q = c;
      else if (c === '/' && text[i + 1] === '/') return text.slice(0, i);
    }
    return text;
  }

  function pythonHabit(lineText) {
    if (lineText == null) return null;
    const t = (/^\s*#/.test(lineText) ? lineText : stripComment(lineText)).replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '""');
    const h = PY_HABITS.find(([re]) => re.test(t));
    return h ? { explain: h[1], fix: h[2] } : null;
  }

  // Habits that make the code unreadable for JavaScript (used to explain syntax errors).
  const SYNTAX_HABITS = new Set([0, 1, 2, 3, 4, 5, 7, 8, 13, 16]);

  function pythonHabitsIn(code) {
    const lines = code.split('\n');
    for (let k = 0; k < lines.length; k++) {
      // ignore text inside quotes, e.g. print('a and b')
      const t = (/^\s*#/.test(lines[k]) ? lines[k] : stripComment(lines[k])).replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '""');
      const idx = PY_HABITS.findIndex(([re], j) => SYNTAX_HABITS.has(j) && re.test(t));
      if (idx >= 0) return { explain: PY_HABITS[idx][1], fix: PY_HABITS[idx][2], line: k + 1 };
    }
    return null;
  }

  /** Best structural explanation for a syntax error in `code`, or null. */
  function analyzeSyntax(code) {
    const s = scan(code);
    const py = pythonHabitsIn(code);
    if (py && (!s || (s.kind === 'bracket' && py.line <= s.line))) {
      return { kind: 'python', line: py.line, col: null, message: `Line ${py.line}: ${py.explain}`, fix: py.fix };
    }
    if (s) return s;
    const lines = code.split('\n');
    for (let k = 0; k < lines.length; k++) {
      const t = stripComment(lines[k]);
      for (const ch of ['@', '#']) {
        const c = t.indexOf(ch);
        if (c >= 0 && !/['"`]/.test(t.slice(0, c))) {
          const [what, fix] = SYMBOLS[ch];
          return { kind: 'symbol', line: k + 1, col: c + 1, message: `Line ${k + 1} contains ${what}.`, fix: `${fix[0].toUpperCase()}${fix.slice(1)}.` };
        }
      }
    }
    return null;
  }

  // ------------------------------------------------------------------
  // Names: "did you mean …?" and "where is it declared?"
  // ------------------------------------------------------------------
  const DECL = /\b(let|const|var|function|class)\s+([A-Za-z_$][\w$]*)/g;
  const MULTI_DECL = /\b(?:let|const|var)\s+([^;=\n]*=[^;\n]*)/g;

  function declarations(name, tasks) {
    const out = [];
    tasks.forEach((t) => {
      t.code.split('\n').forEach((text, k) => {
        const clean = stripComment(text);
        let m;
        DECL.lastIndex = 0;
        while ((m = DECL.exec(clean))) {
          if (m[2] === name) out.push({ task: t.index, line: k + 1, kind: m[1], indent: text.match(/^\s*/)[0].length });
        }
        // let a = 1, b = 2  /  for (let k = 0, …)
        const re = new RegExp(`\\b(?:let|const|var)\\b[^;\\n]*,\\s*${name.replace(/\$/g, '\\$')}\\s*=`);
        if (re.test(clean) && !out.some((d) => d.task === t.index && d.line === k + 1)) {
          out.push({ task: t.index, line: k + 1, kind: (clean.match(/\b(let|const|var)\b/) || [])[1], indent: text.match(/^\s*/)[0].length });
        }
      });
    });
    return out;
  }

  function knownNames(tasks) {
    const names = new Set(root.TOOLBOX_NAMES || []);
    ['Math', 'Number', 'Array', 'Object', 'String', 'JSON', 'console', 'Infinity', 'NaN', 'true', 'false', 'null', 'undefined'].forEach((n) => names.add(n));
    tasks.forEach((t) => {
      let m;
      const c = t.code;
      DECL.lastIndex = 0;
      while ((m = DECL.exec(c))) names.add(m[2]);
      MULTI_DECL.lastIndex = 0;
      while ((m = MULTI_DECL.exec(c))) m[1].split(',').forEach((p) => { const k = p.match(/^\s*([A-Za-z_$][\w$]*)\s*=/); if (k) names.add(k[1]); });
      const params = /\(\s*([\w$,\s]*)\)\s*=>|(\b[\w$]+)\s*=>|function\s*[\w$]*\s*\(([\w$,\s]*)\)/g;
      while ((m = params.exec(c))) (m[1] || m[2] || m[3] || '').split(',').forEach((p) => { p = p.trim(); if (p) names.add(p); });
    });
    return [...names];
  }

  function editDistance(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[a.length][b.length];
  }

  function similarName(name, tasks) {
    const lower = name.toLowerCase();
    let best = null, bestD = Infinity;
    for (const cand of knownNames(tasks)) {
      if (cand === name) continue;
      const d = cand.toLowerCase() === lower ? 0.5 : editDistance(name, cand);
      if (d < bestD) { best = cand; bestD = d; }
    }
    const limit = name.length <= 3 ? 1 : 2;
    return bestD <= limit ? best : null;
  }

  const PY_NAMES = {
    True: 'Write true (lower case).', False: 'Write false (lower case).', None: 'Write null.',
    np: 'numpy is not available — use the Toolbox functions (mul, add, T, inv, linspace, mean, …).',
    numpy: 'numpy is not available — use the Toolbox functions (mul, add, T, inv, linspace, mean, …).',
    len: 'Use array.length instead of len(array).',
    pi: 'Use Math.PI.', π: 'Use Math.PI.',
    sqrt: 'Use Math.sqrt(x).', cos: 'Use Math.cos(x).', sin: 'Use Math.sin(x).', tan: 'Use Math.tan(x).',
    abs: 'Use Math.abs(x).', exp: 'Use Math.exp(x).', log: 'Use Math.log(x).', pow: 'Use x ** n or Math.pow(x, n).',
    radians: 'Use deg2rad(degrees).', degrees: 'Use rad2deg(radians).', arange: 'Use range(start, stop, step).',
    transpose: 'Use T(A).', dot: 'Use mul(A, B).', matmul: 'Use mul(A, B).', identity: 'Use eye(n).',
    θ: 'Did you mean theta?', θ0: 'Did you mean theta?',
  };

  const where = (d, cur) => (d.task === cur ? `line ${d.line}` : `Task ${d.task + 1}, line ${d.line}`);

  // ------------------------------------------------------------------
  // Main entry: explanation for an error
  // ------------------------------------------------------------------
  /**
   * info = {
   *   name, message,               // from the Error
   *   lineText, prevText, col,     // the code at the error position (task-local)
   *   task,                        // index of the failing task
   *   tasks: [{ index, code }],    // ALL tasks (to find declarations)
   *   ranUpTo,                     // index of the last task that was executed
   *   syntaxIssue                  // result of analyzeSyntax for this task, if any
   * }
   */
  function explain(info) {
    const { message: msg, lineText, task, tasks, ranUpTo } = info;
    const name = info.name || 'Error';
    const isSyntax = name === 'SyntaxError';
    const r = { title: '', explain: '', fixes: [], raw: `${name}: ${msg}` };
    const fix = (s) => { if (s && !r.fixes.includes(s)) r.fixes.push(s); };
    let py = pythonHabit(lineText);
    let m;

    // ---------- syntax errors ----------
    if (isSyntax) {
      r.title = 'The code cannot be read (syntax error)';
      const s = info.syntaxIssue;
      if (s) {
        r.explain = s.message;
        fix(s.fix);
        return r;
      }

      if ((m = msg.match(/already been declared|redeclaration of (?:let|const|var) (\S+)|Cannot declare a \w+ variable twice: '([^']+)'/))) {
        const nm = (msg.match(/Identifier '([^']+)'/) || [])[1] || m[1] || m[2];
        const ds = nm ? declarations(nm, tasks.filter((t) => t.index <= ranUpTo)) : [];
        r.title = `“${nm}” is declared twice`;
        r.explain = ds.length > 1
          ? `“${nm}” is declared in ${ds.map((d) => where(d, task)).join(' and ')}. All tasks share one scope (like notebook cells), so every name may only be declared once with let/const.`
          : `“${nm}” is declared more than once. All tasks share one scope (like notebook cells), so every name may only be declared once with let/const.`;
        fix(`To change the existing variable, drop the let/const: ${nm} = …  (and declare the first one with let).`);
        fix('Or give the new variable a different name, e.g. ' + nm + '2.');
        return r;
      }

      if (py) { r.explain = py.explain; fix(py.fix); return r; }

      const tok = (msg.match(/Unexpected token:? '?([^'\s]+)'?|unexpected token: '([^']+)'|got '([^']+)'/) || []).slice(1).find(Boolean);
      const before = (info.prevCode || '').replace(/\s+$/, '');
      const lastCh = before.slice(-1);

      if (/Unexpected end of (input|script)|missing \} after|expected '?\}'?/i.test(msg)) {
        r.explain = 'JavaScript reached the end of the code while a bracket or brace was still open.';
        fix('Check that every (, [ and { has a matching ), ] and }.');
      } else if (/missing \) after argument list|expected '\)'/i.test(msg)) {
        r.explain = 'A function call is not closed properly — often a missing ) or a missing comma between two arguments.';
        fix('Check the brackets of the function call on this line, and put commas between arguments: f(a, b).');
      } else if (/missing \] after element list|Expected '?\]'? to end an array/i.test(msg)) {
        r.explain = 'Something is wrong inside a [ … ] list — usually a missing comma between two items.';
        fix('Separate all items with commas: [1, 0, dt, 0]. Check also that the list is closed with ].');
      } else if (/missing \} after property list|Expected '?\}'? to end an object/i.test(msg)) {
        r.explain = 'Something is wrong inside a { … } object — usually a missing comma between two entries, or a missing }.';
        fix('Write entries as { name: value, other: value } with commas in between.');
      } else if (/missing \) in parenthetical|missing \) after (condition|for-loop control)/i.test(msg)) {
        r.explain = 'A round bracket ( … ) is not closed where JavaScript expects it.';
        fix('Check that every ( on this line has its matching ), and that the line before is complete.');
      } else if (/Missing initializer in const|missing = in const/i.test(msg)) {
        r.explain = 'A const needs a value right away.';
        fix('Write const name = value;  or use let if you want to assign the value later.');
      } else if (/Invalid left-hand side in assignment|invalid assignment left-hand side|Left side of assignment is not a reference/i.test(msg)) {
        r.explain = 'Something that is not a variable stands on the left of =.';
        fix('To compare values use === (not =). To assign, the left side must be a variable, e.g. x = …  or  arr[k] = …');
      } else if (/Invalid or unexpected token|illegal character|Invalid character/i.test(msg)) {
        r.explain = 'This line contains a character that JavaScript does not know — often a symbol copied from a formula or an unclosed quote.';
        fix('Retype the line by hand: use * for multiplication, - for minus, ** 2 for squares, and straight quotes \' or ".');
      } else if (/Unexpected identifier|Unexpected (number|string)|missing ; before statement|Unexpected keyword|Unexpected token '?\w|unexpected token: (identifier|numeric literal|string literal|keyword)/i.test(msg)) {
        const what = (msg.match(/Unexpected identifier '([^']+)'|Unexpected keyword '([^']+)'/) || []).slice(1).find(Boolean);
        if (what === 'else' || tok === 'else') {
          r.explain = 'This else has no matching if right before it.';
          fix('Check the braces: it must look like  if (…) { … } else { … }');
        } else {
          r.explain = `Two things stand next to each other without anything connecting them${what ? ` (before “${what}”)` : ''}.`;
          fix('A comma is missing between list items or function arguments: [a, b] / f(a, b).');
          fix('Or an operator is missing: write 2 * dt, not 2 dt.');
          fix('Or a variable name contains a space — names must be one word, e.g. timeStep.');
        }
      } else if (tok && ')]};,'.includes(tok[0])) {
        if ('=+-*/,(['.includes(lastCh) || /\b(return|let|const)\s*$/.test(before)) {
          r.explain = `A value is missing: after “${lastCh}” JavaScript expects a value, but found “${tok}”.`;
          fix(`Write the missing value after “${lastCh}”, or remove the “${lastCh}”.`);
        } else if (tok === ',') {
          r.explain = 'This comma is in a place where JavaScript does not expect one.';
          fix('Check for doubled commas (,,) or a comma right after an opening bracket.');
        } else {
          r.explain = `“${tok}” appears where JavaScript does not expect it — probably a bracket that does not match.`;
          fix('Check that every (, [ and { has a matching ), ] and } in the right order.');
        }
      } else if (tok === '=' || tok === '=>') {
        r.explain = 'This = is in a place where JavaScript does not expect an assignment.';
        fix('To compare values use ===. Check that the line before is complete.');
      } else if (tok === '.') {
        r.explain = 'A dot in an unexpected place — decimal numbers need a digit before the dot (0.5, not .5 after a name).';
        fix('Write numbers like 0.5 and check for doubled dots.');
      } else if (/Illegal return/i.test(msg)) {
        r.explain = 'return can only be used inside a function.';
        fix('Remove the return, or put the code into a function.');
      } else if (/Octal|leading zero/i.test(msg)) {
        r.explain = 'Numbers must not start with 0 (e.g. 05).';
        fix('Write 5 instead of 05.');
      } else if (/strict mode reserved word|Unexpected (eval|arguments)/i.test(msg)) {
        r.explain = 'This name is reserved in JavaScript and cannot be used for a variable.';
        fix('Choose a different name.');
      } else {
        r.explain = 'JavaScript cannot read this line.';
        fix('Compare the line with the starter code or the Toolbox examples; look for missing brackets, commas or operators.');
      }
      return r;
    }

    // ---------- runtime errors ----------
    r.title = name === 'TypeError' ? 'Something has the wrong type' : name === 'RangeError' ? 'A value is out of range' : name === 'ReferenceError' ? 'Unknown name' : 'Error while running';

    if ((m = msg.match(/^(\S+) is not defined|Can't find variable: (\S+)/))) {
      const nm = m[1] || m[2];
      r.title = `“${nm}” is unknown`;
      const later = declarations(nm, tasks.filter((t) => t.index > ranUpTo));
      const here = declarations(nm, tasks.filter((t) => t.index <= ranUpTo));
      const sym = [...nm].find((ch) => SYMBOLS[ch]);
      if (sym) {
        r.explain = `“${nm}” contains ${SYMBOLS[sym][0]} (copied from a formula?), so JavaScript reads it as an unknown name.`;
        fix(`${SYMBOLS[sym][1][0].toUpperCase()}${SYMBOLS[sym][1].slice(1)}.`);
      } else if (PY_NAMES[nm]) {
        r.explain = `“${nm}” does not exist in JavaScript.`;
        fix(PY_NAMES[nm]);
        py = null;
      } else if (here.some((d) => d.indent > 0)) {
        const d = here.find((x) => x.indent > 0);
        r.explain = `“${nm}” is declared inside a { … } block (${where(d, task)}), e.g. a loop body, and only exists inside that block.`;
        fix(`Use it inside the block, or declare it before the block with let ${nm}; and assign it inside without let/const.`);
      } else if (later.length) {
        r.explain = `“${nm}” is only declared in ${where(later[0], -1)}, which does not run when you press Run here.`;
        fix(`Run from Task ${later[0].task + 1} (or use ▶ Run all), or declare it in this task.`);
      } else {
        const sim = similarName(nm, tasks);
        r.explain = `JavaScript does not know a variable or function called “${nm}”.`;
        if (sim) fix(`Did you mean “${sim}”? (Upper/lower case matters.)`);
        fix(`If it is a new variable, declare it first: let ${nm} = …;`);
      }
    } else if ((m = msg.match(/Cannot access '([^']+)' before initialization|can't access lexical declaration '([^']+)' before initialization|Cannot access uninitialized variable/))) {
      const nm = m[1] || m[2];
      const ds = nm ? declarations(nm, tasks) : [];
      r.title = nm ? `“${nm}” is used before it is declared` : 'A variable is used before it is declared';
      r.explain = ds.length ? `“${nm}” is declared later, in ${where(ds[0], task)}.` : 'The variable is declared further down.';
      fix('Move the declaration above the line that uses it, or use the value only after it has been computed.');
    } else if (/Assignment to constant variable|invalid assignment to const|Attempted to assign to readonly property/.test(msg)) {
      let nm = (msg.match(/const '([^']+)'/) || [])[1];
      if (!nm && lineText) nm = (stripComment(lineText).match(/([A-Za-z_$][\w$]*)\s*(?:[+\-*/%]|\*\*)?=(?!=)/) || [])[1];
      const ds = nm ? declarations(nm, tasks).filter((d) => d.kind === 'const') : [];
      r.title = nm ? `“${nm}” cannot be changed` : 'A constant cannot be changed';
      r.explain = `${nm ? `“${nm}”` : 'This variable'} was declared with const${ds.length ? ` (${where(ds[0], task)})` : ''}, so its value cannot be changed afterwards.`;
      fix(`Declare it with let instead of const${ds.length ? ` in ${where(ds[0], task)}` : ''}.`);
    } else if ((m = msg.match(/Cannot read propert(?:y|ies) of (undefined|null)(?: \(reading '([^']*)'\))?|can't access property "?([^",]+)"?, (.+) is (undefined|null)$|(\S+) is (undefined|null)|undefined is not an object \(evaluating '([^']+)'\)|null is not an object \(evaluating '([^']+)'\)/))) {
      const prop = m[2] || m[3];
      const expr = m[8] || m[9] || m[4] || m[6];
      r.title = 'Something is undefined';
      r.explain = `${expr ? `In “${expr}”, s` : 'S'}omething is undefined${prop ? `, so “${prop}” cannot be read from it` : ''}.`;
      if (prop && /^\d+$/.test(prop)) fix(`Reading [${prop}] failed: an array index is probably out of range. Valid indices go from 0 to length − 1 — check loop bounds like k < arr.length.`);
      fix('Check the spelling of variable and property names, and that the variable has been given a value.');
      fix('Matrices are arrays of rows: write x[2][0] for the 3rd entry of a column vector, A[i][j] for a matrix entry.');
    } else if ((m = msg.match(/^(.+?) is not a function|^(.+?) is not a function\. \(In '/))) {
      const what = (m[1] || m[2]).replace(/^\(?intermediate value\)?/, 'this value');
      r.title = `“${what}” is not a function`;
      const base = what.split('.').pop();
      if (/\.toFixed$/.test(what)) {
        r.explain = `${what.replace(/\.toFixed$/, '')} is not a number — toFixed only works on numbers. It is probably an array or a matrix.`;
        fix('Check that the value is a single number, e.g. mean(errors), or x[0][0] for an entry of a column vector.');
      } else if (/\.(map|filter|push|forEach|reduce)$/.test(what)) {
        r.explain = `${what.replace(/\.\w+$/, '')} is not an array, so .${base}() is not available.`;
        fix('Check that the variable holds an array (a list of values or points).');
      } else if (base === 'append') {
        r.explain = '.append() is Python.'; fix('Use .push(value).');
      } else {
        const sim = /^[\d.]+$/.test(base) ? null : similarName(base, tasks);
        r.explain = `You are calling “${what}” with ( ), but it is not a function.`;
        if (sim) fix(`Did you mean “${sim}”?`);
        fix('Numbers or values next to brackets need an operator: write 2 * (a + b), not 2(a + b).');
        if (!/^[\d.]+$/.test(base)) fix('Check that you have not overwritten a Toolbox function with a variable of the same name (e.g. const T = …).');
      }
    } else if (/is not iterable/.test(msg)) {
      r.explain = 'You are looping over something that is not an array.';
      fix('for (const x of arr) needs an array. For counting use for (let k = 0; k < n; k++).');
    } else if (/Maximum call stack|too much recursion/.test(msg)) {
      r.explain = 'A function keeps calling itself without end.';
      fix('Check that the recursion has a stopping condition, or use a loop.');
    } else if (/Invalid array length/.test(msg)) {
      r.explain = 'An array with a negative or invalid length was requested.';
      fix('Check the arguments of range/linspace/zeros: e.g. range(start, stop, step) needs stop > start.');
    } else if (/^(mul|add|sub|scale|T|inv|diag|col|flat|range|mean|interp|sampleAt|dist|norm)\(\)/.test(msg)) {
      r.title = `Problem in ${msg.match(/^(\w+)/)[1]}()`;
      r.explain = msg;
      if (/got undefined/.test(msg)) {
        if (/\[[^\]]*[+-]\s*\d+\s*\]/.test(lineText || '')) fix('An index like [k + 1] may point past the end of the array (valid: 0 … length − 1).');
        fix('One of the arguments is undefined — check the spelling of the variable names and the array indices on this line.');
      }
      if (/plain array/.test(msg)) fix('Vectors that take part in matrix maths must be column vectors: col([a, b, c]).');
      if (/cannot multiply/.test(msg)) fix('For A·B the number of columns of A must equal the number of rows of B. Is a transpose T(…) missing, or are the factors in the wrong order?');
      if (/shapes do not match/.test(msg)) fix('Both matrices must have the same size for add/sub. Compare with the equation — maybe a factor is missing.');
      if (/singular/.test(msg)) fix('The matrix cannot be inverted. Check that R and P are not all zeros.');
    } else if (/^plot\w+\(\)/.test(msg)) {
      r.title = 'Problem with the plot data';
      r.explain = msg;
      fix('Trajectories are arrays of [x, y] points, e.g. tObs.map(t => [x(t), y(t)]).');
    } else {
      r.explain = msg;
    }

    if (py && !r.fixes.some((f) => f.includes(py.fix))) fix(`${py.explain} ${py.fix}`);
    if (!r.fixes.length) {
      fix(info.hasLine
        ? 'Check the values used on the marked line: add print(…) right before it, e.g. print(x, P).'
        : 'Find the line: put print(1), print(2), … between your lines and run again. The problem is right after the last number that appears.');
    }
    if (!info.hasLine && r.fixes.length && !r.fixes.some((f) => f.includes('print('))) {
      fix('To find the line: put print(1), print(2), … between your lines and run again. The problem is right after the last number that appears.');
    }
    return r;
  }

  root.ErrorHelp = { analyzeSyntax, explain, scan };
})(globalThis);
