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
 * Tiny dependency-free code editor: a <textarea> layered over a highlighted
 * <pre>, plus a line-number gutter. Works offline and from file://.
 *
 * Keys: Tab / Shift+Tab indent, Enter keeps indentation,
 *       Ctrl/Cmd+/ toggles comments, Ctrl/Cmd+Enter runs (onRun callback).
 *       Esc then Tab moves focus out of the editor.
 */
(function (root) {
  'use strict';

  const KEYWORDS = new Set(('break case catch class const continue default delete do else export extends false finally for ' +
    'function if in instanceof let new null of return switch this throw true try typeof undefined var void while yield').split(' '));
  const BUILTINS = new Set(('zeros ones eye diag col flat T mul add sub scale inv range linspace interp sampleAt norm dist sum mean ' +
    'max min argmax deg2rad rad2deg seed rand randn print plotScene plotLines plotBars Math').split(' '));

  const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|('(?:\\.|[^'\\\n])*'?|"(?:\\.|[^"\\\n])*"?|`(?:\\.|[^`\\])*`?)|(\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b|\.\d+\b)|([A-Za-z_$][\w$]*)/g;

  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function highlight(code) {
    let out = '', last = 0, m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(code))) {
      out += esc(code.slice(last, m.index));
      const [tok, comment, str, num, ident] = m;
      if (comment) out += `<span class="tk-com">${esc(tok)}</span>`;
      else if (str) out += `<span class="tk-str">${esc(tok)}</span>`;
      else if (num) out += `<span class="tk-num">${tok}</span>`;
      else if (ident && KEYWORDS.has(ident)) out += `<span class="tk-kw">${tok}</span>`;
      else if (ident && BUILTINS.has(ident)) out += `<span class="tk-fn">${tok}</span>`;
      else out += esc(tok);
      last = m.index + tok.length;
    }
    return out + esc(code.slice(last)) + '\n';
  }

  /** Insert text keeping the browser undo stack where possible. */
  function insert(ta, text) {
    ta.focus();
    if (!document.execCommand || !document.execCommand('insertText', false, text)) {
      ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
      ta.dispatchEvent(new Event('input'));
    }
  }

  class Editor {
    constructor(host, { value = '', onChange, onRun, label } = {}) {
      this.onChange = onChange;
      this.onRun = onRun;
      host.classList.add('editor');
      host.innerHTML = '<div class="ed-gutter" aria-hidden="true"></div>' +
        '<div class="ed-body"><pre class="ed-hl" aria-hidden="true"></pre>' +
        '<textarea class="ed-input" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off"></textarea></div>';
      this.gutter = host.querySelector('.ed-gutter');
      this.body = host.querySelector('.ed-body');
      this.pre = host.querySelector('.ed-hl');
      this.ta = host.querySelector('textarea');
      if (label) this.ta.setAttribute('aria-label', label);
      this.ta.value = value;
      this.errorLine = null;
      this.escaped = false;

      this.ta.addEventListener('input', () => { this.errorLine = null; this.refresh(); this.onChange && this.onChange(this.value); });
      this.ta.addEventListener('keydown', (e) => this.keydown(e));
      this.ta.addEventListener('scroll', () => { this.ta.scrollTop = 0; this.ta.scrollLeft = 0; });
      this.refresh();
    }

    get value() { return this.ta.value; }

    /** Replace the whole content (undoable with Ctrl/Cmd+Z). */
    setValue(v) {
      this.ta.focus();
      this.ta.select();
      insert(this.ta, v);
      this.ta.setSelectionRange(0, 0);
      this.body.scrollLeft = 0;
    }

    markError(line) { this.errorLine = line; this.refresh(); }

    /** Put the cursor on a line (1-based) and scroll it into view. */
    goToLine(line, col) {
      const lines = this.ta.value.split('\n');
      const l = Math.min(Math.max(1, line), lines.length);
      let pos = 0;
      for (let k = 0; k < l - 1; k++) pos += lines[k].length + 1;
      const end = pos + lines[l - 1].length;
      this.ta.focus({ preventScroll: true });
      this.ta.setSelectionRange(col ? Math.min(pos + col - 1, end) : pos, col ? Math.min(pos + col - 1, end) : end);
      const row = this.gutter.children[l - 1];
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    refresh() {
      const v = this.ta.value;
      this.pre.innerHTML = highlight(v);
      const n = v.split('\n').length;
      let g = '';
      for (let i = 1; i <= n; i++) g += `<div${i === this.errorLine ? ' class="err"' : ''}>${i}</div>`;
      this.gutter.innerHTML = g;
      // size the textarea to its content so the page (not the textarea) scrolls
      this.ta.style.height = 'auto';
      this.ta.style.width = 'auto';
      this.ta.style.height = this.pre.offsetHeight + 'px';
      this.ta.style.width = Math.max(this.body.clientWidth, this.pre.scrollWidth) + 'px';
    }

    lineBounds() {
      const v = this.ta.value, s = this.ta.selectionStart, e = this.ta.selectionEnd;
      const start = v.lastIndexOf('\n', s - 1) + 1;
      let end = v.indexOf('\n', e - (e > s && v[e - 1] === '\n' ? 1 : 0));
      if (end === -1) end = v.length;
      return { start, end };
    }

    transformLines(fn) {
      const { start, end } = this.lineBounds();
      const lines = this.ta.value.slice(start, end).split('\n');
      const next = fn(lines).join('\n');
      this.ta.setSelectionRange(start, end);
      insert(this.ta, next);
      this.ta.setSelectionRange(start, start + next.length);
    }

    keydown(e) {
      const ta = this.ta;
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Escape') { this.escaped = true; return; }
      if (mod && e.key === 'Enter') { e.preventDefault(); this.onRun && this.onRun(); return; }
      if (e.key === 'Tab' && !mod && !e.altKey) {
        if (this.escaped) { this.escaped = false; return; } // let focus leave
        e.preventDefault();
        const multi = ta.value.slice(ta.selectionStart, ta.selectionEnd).includes('\n');
        if (e.shiftKey) this.transformLines((ls) => ls.map((l) => l.replace(/^ {1,2}/, '')));
        else if (multi) this.transformLines((ls) => ls.map((l) => '  ' + l));
        else insert(ta, '  ');
        return;
      }
      this.escaped = false;
      if (mod && e.key === '/') {
        e.preventDefault();
        this.transformLines((ls) => {
          const all = ls.filter((l) => l.trim()).every((l) => /^\s*\/\//.test(l));
          return ls.map((l) => (all ? l.replace(/^(\s*)\/\/ ?/, '$1') : l.trim() ? l.replace(/^(\s*)/, '$1// ') : l));
        });
        return;
      }
      if (e.key === 'Enter' && !mod && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        const v = ta.value, s = ta.selectionStart;
        const line = v.slice(v.lastIndexOf('\n', s - 1) + 1, s);
        let indent = line.match(/^\s*/)[0];
        if (/[{[(]\s*$/.test(line)) indent += '  ';
        insert(ta, '\n' + indent);
      }
    }
  }

  root.Editor = Editor;
})(globalThis);
