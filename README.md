# Karl's Catapult — Kalman filter workshop (web version)

Hands-on part of the talk *State Estimation and Kalman Filter* (`../Workshop Sensors Schaefer.pptx`).
Participants help Karl the Little track his catapult stones: true trajectory → noisy observations →
Kalman filter → velocity estimation → bonus: prediction behind the castle wall.

## Running it

Open `index.html` in any current browser (Chrome, Firefox, Safari, Edge). That's it:
no installation, no server, no internet connection needed. To share it, copy the folder
(or zip it) or put it on any static web host.

Participants write **JavaScript** in the editors. Each task's **▶ Run** (or Ctrl/⌘+Enter)
executes all tasks up to that one in a shared scope, like notebook cells. Automatic checks
below each output show whether the results are plausible. Code is saved in the browser's
local storage; **Save code** downloads it as one `.js` file.

## Files

| Path | Purpose |
|---|---|
| `index.html` | Story, model, task descriptions and **starter code** (`<script type="text/plain" class="starter">`) |
| `js/linalg.js` | Toolbox replacing numpy: `mul`, `add`, `sub`, `T`, `inv`, `eye`, `diag`, `col`, `range`, `linspace`, `sampleAt`, `dist`, `mean`, `seed`/`randn`, … |
| `js/plot.js` | SVG charts replacing matplotlib / `utilities.py` |
| `js/editor.js` | Lightweight code editor (highlighting, line numbers, indentation, comment toggle) |
| `js/errors.js` | Turns errors into plain-language explanations with fix suggestions (brackets, strings, copied math symbols, Python habits, typos, scope) |
| `js/app.js` | Runner, error reporting with line numbers, automatic checks (`CHECKS`), persistence |
| `solutions/solutions.js` | Sample solutions; enables the **Show solution** buttons |
| `legacy/` | The original Jupyter notebooks (2023), `utilities.py` and the original `Code.zip` |

## For instructors

- **Hide the solutions:** delete `solutions/solutions.js` (or its `<script>` line in `index.html`)
  before handing out the folder. Without it the buttons don't appear.
- **Change a task:** edit the text and starter code in `index.html`; the checks for each
  task live in `CHECKS` in `js/app.js` (selected via `data-check` on the section).
- Participants' saved code survives reloads. After changing starter code, they get the new
  version only after pressing **Reset** on that task (or in a fresh browser).
- Expected results with the sample solution: optimal angle ≈ 45°, landing after 2.02 s at
  19.98 m; mean observation error 0.384 m, Kalman filter 0.150 m; mean velocity error 0.39 m/s.

## Changes compared to the 2023 notebook

- No Python/Jupyter needed; everything runs in the browser.
- Story name aligned with the slides (Karl the Little).
- Task 2 now observes the whole flight with noise in both directions; restricting
  observations to the first half moved to the bonus task (the old sample solution mixed both).
- Fixed the model equations in the introduction (positions instead of mixed derivatives),
  typos, and the broken `<li>` in the bonus task.
- Added automatic checks, hints, a reference of the Kalman filter equations, and suggestions
  for further experiments from the slides (wrong initial value, wind, model mismatch).
