"""exFuzzy Lab: the same experiment runs in the browser and in Python.

The learner is an ex_fuzzy 3.3.0 classifier chosen in config["learner"]:
FuzzyRulesClassifier (additive or sufficient rule voting), FERL (a fuzzy
rule tree), or the PyMoo-based RuleMineClassifier and RuleFineTuneClassifier.
Numerical partitions, categorical memberships, rule mining, genetic selection
and tree growth are library code. Preprocessing and partitions are fitted to
training rows only.
"""
import contextlib
import io
import hashlib
import json
import math
import platform
import time
import warnings

import numpy as np
import pandas as pd
import sklearn
import scipy
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, balanced_accuracy_score, f1_score, confusion_matrix, classification_report

import ex_fuzzy
from ex_fuzzy import FuzzyRulesClassifier, FERL, RuleMineClassifier, RuleFineTuneClassifier, fuzzy_sets as fs, utils

try:
    import pymoo
    PYMOO_VERSION = pymoo.__version__
except Exception:  # pragma: no cover - PyMoo is required by ex-fuzzy; this only keeps the report informative
    PYMOO_VERSION = None

VERSION = "3.3.0"
# All learners run in the browser engine: the app vendors PyMoo as a pure-Python wheel.
LEARNERS = {
    "association_additive": dict(label="Association rules, additive voting", cls="FuzzyRulesClassifier", rule_mode="additive"),
    "association_sufficient": dict(label="Association rules, strongest rule", cls="FuzzyRulesClassifier", rule_mode="sufficient"),
    "ferl": dict(label="FERL rule tree", cls="FERL"),
    "rule_mine": dict(label="Rule mining + genetic optimisation", cls="RuleMineClassifier"),
    "rule_finetune": dict(label="Rule mining + genetic fine-tuning", cls="RuleFineTuneClassifier"),
}


def _evolutionary_rules(master, features, partitions):
    """Rules of a fitted MasterRuleBase (one RuleBase per class).

    Antecedents are term indexes per feature (-1 = unused). confidence and support are the training
    statistics computed by the library's rule evaluation; weight is the rule's dominance score, which is
    the weight the library applies in its default inference mode (ds_mode 0, winning rule decides)."""
    names = master.get_consequents_names()
    rules = []
    for ci, rb in enumerate(master.rule_bases):
        for rule in rb.rules:
            conditions = [dict(feature=features[f], term=str(partitions[f][int(t)].name)) for f, t in enumerate(rule.antecedents) if int(t) >= 0]
            rules.append(dict(id=len(rules) + 1, conditions=conditions, consequent=str(names[ci]),
                              confidence=float(getattr(rule, "confidence", float("nan"))),
                              support=float(getattr(rule, "support", float("nan"))),
                              weight=float(getattr(rule, "score", float("nan")))))
    return rules


def _ferl_rules(model, features, partitions, y_train):
    """Every non-root tree node is a rule: its path is the antecedent and its majority class the consequent.

    confidence = membership-weighted share of the consequent class among the rows the node covers;
    support = membership mass of the consequent class covered by the node, divided by that class's row count.
    These are the same training statistics the association miner reports. FERL has no certainty-factor
    weight: its votes use the node's class probabilities, so weight is null."""
    classes = [str(c) for c in model.classes_]
    n = len(y_train)
    class_count = {c: int((y_train == c).sum()) for c in classes}
    rules = []

    def walk(node, path):
        for child in node.get("children", {}).values():
            step = path + [(int(child["feature"]), int(child["fuzzy_set"]))]
            consequent = str(child["prediction"])
            probs = np.asarray(child["class_probabilities"], float)
            conf = float(probs[classes.index(consequent)]) if consequent in classes and probs.size == len(classes) else float("nan")
            coverage = float(child["coverage"])
            support = coverage * n * conf / max(class_count.get(consequent, 0), 1)
            rules.append(dict(conditions=[dict(feature=features[f], term=str(partitions[f][t].name)) for f, t in step],
                              consequent=consequent, confidence=conf, support=support, weight=None, depth=len(step)))
            walk(child, step)

    walk(model._root, [])
    rules.sort(key=lambda r: r["depth"])
    for i, r in enumerate(rules):
        r.pop("depth")
        r["id"] = i + 1
    return [dict(id=r["id"], conditions=r["conditions"], consequent=r["consequent"], confidence=r["confidence"],
                 support=r["support"], weight=r["weight"]) for r in rules]


def read_frame(csv_text, separator="auto"):
    sep = None if separator == "auto" else separator
    frame = pd.read_csv(io.StringIO(csv_text), sep=sep, engine="python" if sep is None else "c", keep_default_na=True)
    frame.columns = [str(c).strip() for c in frame.columns]
    if len(set(frame.columns)) != len(frame.columns):
        raise ValueError("Column names must be unique after trimming whitespace.")
    if len(frame.columns) < 2:
        raise ValueError("The file needs at least one predictor and a target column. Check the delimiter.")
    return frame.replace([np.inf, -np.inf], np.nan)


def inspect_dataset(csv_text, separator="auto"):
    frame = read_frame(csv_text, separator)
    if not 10 <= len(frame) <= 5000:
        raise ValueError("This browser workspace supports 10 to 5,000 rows per dataset.")
    mask = utils.detect_categorical_mask(frame)
    columns = []
    for i, name in enumerate(frame.columns):
        s = frame[name]
        columns.append(dict(name=name, kind="categorical" if mask[i] else "numeric", unique=int(s.nunique()),
                            missing=int(s.isna().sum()), examples=[str(v) for v in s.dropna().unique()[:4]]))
    preview = json.loads(frame.head(8).to_json(orient="records"))
    return dict(rows=len(frame), columns=columns, preview=preview, missing=int(frame.isna().sum().sum()))


def _metrics(y, pred):
    return dict(accuracy=float(accuracy_score(y, pred)), balanced_accuracy=float(balanced_accuracy_score(y, pred)),
                macro_f1=float(f1_score(y, pred, average="macro", zero_division=0)))


def run_experiment(csv_text, config):
    if ex_fuzzy.__version__ != VERSION:
        raise ValueError("This experiment requires ex-fuzzy==3.3.0.")
    started = time.perf_counter()
    frame = read_frame(csv_text, config.get("separator", "auto"))
    if not 10 <= len(frame) <= 5000:
        raise ValueError("Use a dataset with 10 to 5,000 rows.")
    target = config["target"]
    features = list(config["features"])
    if target not in frame or target in features or not 1 <= len(features) <= 12 or len(set(features)) != len(features):
        raise ValueError("Select a target and 1 to 12 distinct predictors, excluding the target.")
    if any(f not in frame for f in features):
        raise ValueError("A selected predictor is missing from the file.")
    seed = int(config.get("seed", 42))
    test_fraction = float(config.get("test_size", .25))
    if not .15 <= test_fraction <= .4:
        raise ValueError("Test size must be between 15% and 40%.")
    n_rules, n_ants = int(config.get("n_rules", 15)), int(config.get("n_ants", 2))
    n_terms, n_gen, pop_size = int(config.get("n_terms", 3)), int(config.get("n_gen", 40)), int(config.get("pop_size", 40))
    if not (2 <= n_rules <= 40 and 1 <= n_ants <= 3 and 2 <= n_terms <= 5 and 1 <= n_gen <= 200 and 4 <= pop_size <= 100):
        raise ValueError("One of the training parameters is outside its supported range.")
    learner_key = str(config.get("learner", "association_additive"))
    if learner_key not in LEARNERS:
        raise ValueError("Unknown learner. Choose one of: " + ", ".join(LEARNERS))
    learner = LEARNERS[learner_key]
    missing_target = int(frame[target].isna().sum())
    frame = frame.loc[frame[target].notna()].copy()
    # Labels are displayed and evaluated as strings throughout, including numeric labels.
    y = frame[target].astype(str).to_numpy()
    classes, counts = np.unique(y, return_counts=True)
    if not 2 <= len(classes) <= 12:
        raise ValueError("Classification needs 2 to 12 target classes. Choose a categorical target.")
    if counts.min() < 3:
        raise ValueError("Each target class needs at least 3 rows for a stratified split.")
    n_test = max(len(classes), int(math.ceil(len(frame) * test_fraction)))
    if len(frame) - n_test < len(classes):
        raise ValueError("There are too few rows to include every class in both splits.")
    train_i, test_i = train_test_split(np.arange(len(frame)), test_size=n_test, stratify=y, random_state=seed)
    raw = frame[features]
    train_raw, test_raw = raw.iloc[train_i], raw.iloc[test_i]
    detected = utils.detect_categorical_mask(train_raw)
    kinds = config.get("kinds", {})
    train = np.zeros((len(train_i), len(features)), float)
    test = np.zeros((len(test_i), len(features)), float)
    cat_mask = np.zeros(len(features), int)
    preprocessing, notes = [], []
    category_labels = {}
    for j, name in enumerate(features):
        kind = kinds.get(name, "categorical" if detected[j] else "numeric")
        a, b = train_raw[name], test_raw[name]
        if kind == "categorical":
            # Codes are identifiers for equality memberships, never an ordinal scale.
            a = a.map(lambda v: "(missing)" if pd.isna(v) else str(v))
            b = b.map(lambda v: "(missing)" if pd.isna(v) else str(v))
            categories = sorted(a.unique().tolist())
            if len(categories) > 24:
                raise ValueError(f"'{name}' has {len(categories)} training categories; the browser limit is 24. Exclude identifiers or group categories first.")
            mapping = {v: i for i, v in enumerate(categories)}
            train[:, j] = a.map(mapping).to_numpy()
            test[:, j] = b.map(mapping).fillna(-1).to_numpy()
            cat_mask[j] = len(categories)
            category_labels[j] = categories
            unseen = int((test[:, j] == -1).sum())
            if unseen:
                notes.append(f"{name}: {unseen} test rows contain categories unseen during training; no categorical term fires for those values.")
            preprocessing.append(dict(name=name, kind=kind, categories=categories, unseen_test=unseen))
        elif kind == "numeric":
            a_num, b_num = pd.to_numeric(a, errors="coerce"), pd.to_numeric(b, errors="coerce")
            if (a.notna() & a_num.isna()).any() or (b.notna() & b_num.isna()).any():
                raise ValueError(f"'{name}' contains non-numeric values. Change its type to categorical.")
            median = float(a_num.median())
            if not np.isfinite(median):
                raise ValueError(f"'{name}' has no valid numeric training values. Exclude it or change its type.")
            train[:, j], test[:, j] = a_num.fillna(median), b_num.fillna(median)
            preprocessing.append(dict(name=name, kind=kind, median=median))
        else:
            raise ValueError("Unknown column type.")
    train_df, test_df = pd.DataFrame(train, columns=features), pd.DataFrame(test, columns=features)
    partitions = utils.construct_partitions(train_df, fs.FUZZY_SETS.t1, categorical_mask=cat_mask, n_partitions=n_terms)
    for j, labels in category_labels.items():
        for term in partitions[j]:
            term.name = labels[int(term.category)]
    evolutionary = learner["cls"] in ("RuleMineClassifier", "RuleFineTuneClassifier")
    if learner["cls"] == "FERL":
        # The same fixed partitions; the tree depth bounds the conditions per rule. No genetic search is involved.
        model = FERL(fuzzy_partitions=partitions, max_rules=n_rules, max_depth=min(n_ants, len(features)), random_state=seed)
    elif evolutionary:
        # Mined candidate rules, then PyMoo's genetic algorithm selects (and for fine-tune, re-optimizes) the rule base.
        cls = RuleMineClassifier if learner["cls"] == "RuleMineClassifier" else RuleFineTuneClassifier
        model = cls(nRules=n_rules, nAnts=min(n_ants, len(features)), fuzzy_type=fs.FUZZY_SETS.t1, linguistic_variables=partitions,
                    n_gen=n_gen, pop_size=pop_size, patience=min(20, n_gen), random_state=seed)
    else:
        # Fixed T1 partitions and the library's own native genetic rule selection.
        model = FuzzyRulesClassifier(nRules=n_rules, nAnts=min(n_ants, len(features)), fuzzy_type=fs.FUZZY_SETS.t1,
                                    linguistic_variables=partitions, max_features=None, min_support=.05,
                                    min_confidence=.5, candidates_per_class=40, n_gen=n_gen, pop_size=pop_size,
                                    patience=min(20, n_gen), random_state=seed, rule_mode=learner["rule_mode"])
    captured = []
    with warnings.catch_warnings(record=True) as ws:
        warnings.simplefilter("always")
        model.fit(train_df, y[train_i])
        train_pred, test_pred = np.asarray(model.predict(train_df)), np.asarray(model.predict(test_df))
        captured = sorted(set(str(w.message) for w in ws))
    train_classes, train_counts = np.unique(y[train_i], return_counts=True)
    majority = str(train_classes[np.argmax(train_counts)])
    variables = []
    for j, v in enumerate(partitions):
        is_cat = bool(cat_mask[j])
        terms = []
        if is_cat:
            for t in v:
                terms.append(dict(name=str(t.name), category=str(t.name)))
            variables.append(dict(name=features[j], kind="categorical", terms=terms))
        else:
            lo, hi = v.domain()
            grid = np.linspace(float(lo), float(hi), 81)
            for t in v:
                terms.append(dict(name=str(t.name), y=np.asarray(t.membership(grid), float).tolist(),
                                  parameters=[float(k) for k in t.membership_parameters]))
            variables.append(dict(name=features[j], kind="numeric", x=grid.tolist(), terms=terms))
    rules_out = []
    if evolutionary:
        inner = model.fl_classifier2_ if hasattr(model, "fl_classifier2_") else model.fl_classifier_
        master = inner.rule_base
        rules_out = _evolutionary_rules(master, features, partitions)
        # The library returns no class ('Unknown') for rows that fire no rule. The app assigns the training
        # majority class instead, flags those rows, and says so in the notes, so metrics stay comparable.
        fire_train = np.asarray(master.compute_firing_strenghts(train_df.to_numpy()), float)
        fire_test = np.asarray(master.compute_firing_strenghts(test_df.to_numpy()), float)
        no_match = fire_test.max(axis=1) <= 1e-12 if fire_test.size else np.ones(len(test_i), bool)
        train_no_match = fire_train.max(axis=1) <= 1e-12 if fire_train.size else np.ones(len(train_i), bool)
        train_pred = train_pred.astype(object); test_pred = test_pred.astype(object)
        train_pred[train_no_match] = majority; test_pred[no_match] = majority
        train_pred = train_pred.astype(str); test_pred = test_pred.astype(str)
        rules_text = master.print_rules(return_rules=True)
    elif learner["cls"] == "FERL":
        rules_out = _ferl_rules(model, features, partitions, y[train_i])
        no_match = np.asarray(model.firing_strength(test_df), float) <= 1e-12
        tree_text = io.StringIO()
        with contextlib.redirect_stdout(tree_text):
            model.print_tree()
        rules_text = tree_text.getvalue()
    else:
        pool = model._rules
        for i in range(model.n_rules_):
            conditions = []
            for f, t in zip(pool["features"][i], pool["terms"][i]):
                feature_idx = int(model.selected_features_[f])
                conditions.append(dict(feature=features[feature_idx], term=str(partitions[feature_idx][int(t)].name)))
            rules_out.append(dict(id=i + 1, conditions=conditions, consequent=str(model.classes_[pool["consequent"][i]]),
                                  confidence=float(pool["confidence"][i]), support=float(pool["support"][i]), weight=float(pool["weight"][i])))
        scores = np.asarray(model._scores(test_df), float)
        no_match = np.all(scores == 0, axis=1)
        rules_text = model.print_rules(return_rules=True)
    predictions = []
    for i, row_i in enumerate(test_i):
        predictions.append(dict(row=int(frame.index[row_i]) + 2, actual=str(y[row_i]), predicted=str(test_pred[i]),
                                correct=bool(y[row_i] == test_pred[i]), fallback=bool(no_match[i]),
                                values={f: None if pd.isna(raw.iloc[row_i][f]) else str(raw.iloc[row_i][f]) for f in features}))
    if no_match.any():
        notes.append(f"{int(no_match.sum())} test rows fired no rule and used the training majority class"
                     + (" (the learner itself returns no class for them)." if evolutionary else "."))
    if missing_target:
        notes.append(f"{missing_target} rows with a missing target were excluded before splitting.")
    return dict(version=VERSION, learner=learner["cls"], learner_key=learner_key, learner_label=learner["label"], config=config,
                dataset_sha256=hashlib.sha256(csv_text.encode("utf-8")).hexdigest(),
                environment=dict(python=platform.python_version(), numpy=np.__version__, pandas=pd.__version__,
                                 scipy=scipy.__version__, scikit_learn=sklearn.__version__, pymoo=PYMOO_VERSION),
                train_rows=len(train_i), test_rows=len(test_i), excluded_target_rows=missing_target,
                train_indices=[int(frame.index[i]) + 2 for i in train_i], test_indices=[int(frame.index[i]) + 2 for i in test_i],
                train_metrics=_metrics(y[train_i], train_pred), test_metrics=_metrics(y[test_i], test_pred),
                classes=[str(c) for c in model.classes_],
                confusion=confusion_matrix(y[test_i], test_pred, labels=model.classes_).tolist(),
                report=classification_report(y[test_i], test_pred, labels=model.classes_, output_dict=True, zero_division=0),
                rules=rules_out, rules_text=rules_text,
                variables=variables, preprocessing=preprocessing, predictions=predictions,
                conditions=sum(len(r["conditions"]) for r in rules_out), elapsed=round(time.perf_counter()-started, 3),
                notes=notes, warnings=captured)


if __name__ == "__main__":
    from pathlib import Path
    config = json.loads(Path("config.json").read_text(encoding="utf-8"))
    result = run_experiment(Path("dataset.csv").read_text(encoding="utf-8-sig"), config)
    Path("reproduced-results.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result["test_metrics"], indent=2))
