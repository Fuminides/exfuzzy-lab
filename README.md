# exFuzzy Lab

A visual research workspace, in English, for Type-1 fuzzy classification with **ex-fuzzy 3.3.0**.

## Run

The interface is designed for desktop and laptop screens (about 1000 px and wider); it is not laid out for phones. Serve `dist/` with any static web server. For example, from this directory:

```text
python -m http.server 8000 --directory dist
```

Open `http://localhost:8000`. HTTPS or localhost is required. Opening `index.html` as a file does not support the worker. The Python engine (Pyodide 0.29.5 with NumPy, pandas, SciPy and scikit-learn) is served from `dist/pyodide/`, mirrored from the official Pyodide distribution, so the app has no runtime dependency on a third-party CDN; it starts in the background when the page loads, and datasets are inspected in JavaScript, so Python is only needed to run an experiment. A first visit transfers about 40 MB, which the browser then caches. Fonts come from Google Fonts.

## What runs

`dist/worker.js` runs `dist/engine.py` in an isolated Python Web Worker. It installs PyMoo 0.6.1.6 and the unmodified official `ex_fuzzy-3.3.0-py3-none-any.whl`, with SHA-256:

```text
56015f555ad627f4a097fdd470dc067b9cc38fc51f2a755b14d33ac9c556fa07
```

The learner is chosen in the experiment settings (`config.learner`):

- `association_additive` (default): the library's `FuzzyRulesClassifier` with fixed partitions, fuzzy association rule mining, native genetic rule selection and additive weighted voting.
- `association_sufficient`: the same classifier with `rule_mode="sufficient"`, where only each class's strongest matching rule counts.
- `ferl`: the library's `FERL` fuzzy rule tree on the same partitions; the rule budget bounds the tree size and the maximum conditions per rule bounds its depth. Tree nodes are exported as rules (no weight).
- `rule_mine` and `rule_finetune`: the library's `RuleMineClassifier` and `RuleFineTuneClassifier`, which mine candidate rules and let PyMoo's genetic algorithm select (and, for fine-tune, re-optimize) the rule base on the same partitions.

The browser engine uses PyMoo 0.6.1.6, vendored in `dist/vendor/` with its dependencies as pure-Python wheels.

## Research protocol

- Seeded stratified holdout; 15–40% test fraction.
- Numeric medians, category vocabularies and fuzzy partitions are fitted to training rows only.
- Missing target rows are excluded before splitting.
- Unseen test categories fire no categorical term; rows firing no rules use the learner's training majority fallback and are flagged.
- Confidence/support shown for rules come from training data. Certainty-factor weights and normalized rule scores are not calibrated probabilities.
- Macro F1, balanced accuracy, accuracy, per-class metrics, confusion matrix and held-out predictions are computed from actual model predictions.
- Configurations, exact row assignments, preprocessing state and library environment are included in exports.
- Repeated tuning against a holdout biases its estimate. A separate final evaluation dataset is appropriate for research reporting.

## Scope and limits

Classification only, T1 only. 10–5,000 rows, up to 12 predictors, 24 training categories per categorical predictor, 2–12 target classes and at least 3 rows per class. CSV/TSV size limit: 2 MB. Numeric terms: 2–5. Maximum rule conditions: 1–3. Training can be canceled by terminating the worker. Runs are kept only in tab memory; refresh clears them. No server-side data storage, accounts or cross-session experiment history is implemented.

Save model downloads a ZIP with `model.pkl` (the trained model and its preprocessing) and `load_model.py` to predict new rows, plus the original dataset, configuration, results, predictions, rules and `experiment.py` (the same code as `engine.py`) with pinned Python requirements. Native package platforms can differ from WASM; floating-point differences may change genetic results across platforms.

## Source and licenses

App: AGPL-3.0-or-later, see `LICENSE`. exFuzzy: AGPL-3.0-or-later, see `dist/EXFUZZY-LICENSE.txt` and [release source](https://github.com/Fuminides/ex-fuzzy/tree/v3.3.0).

Source download links are on the Source & licenses page linked in the footer. Iris is scikit-learn's standard Iris dataset; material screening is synthetic with seed 2026, explicitly labeled in the interface. The brand mark in `dist/brand/` is the official Ex-Fuzzy logo from the ex-fuzzy repository README. Interface icons and diagrams are original SVG/CSS artwork. DM Sans and Manrope are served by Google Fonts under their respective Open Font Licenses.
