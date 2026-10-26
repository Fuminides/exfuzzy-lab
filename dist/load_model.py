"""Reload a model saved by exFuzzy Lab and predict on new rows.

Command line:
    python load_model.py new_rows.csv
  reads a CSV with the same column names as the training data, writes
  new_rows.predictions.csv next to it and prints a short summary.

Python:
    from load_model import load_model
    model = load_model("model.pkl")
    labels = model.predict(frame)          # frame: a pandas DataFrame
    model.print_rules()

model.pkl is a Python pickle made with the package versions in requirements.txt.
Only open model files you saved yourself.
"""
import pickle
import sys
from pathlib import Path

import numpy as np
import pandas as pd


class SavedModel:
    def __init__(self, saved):
        self.learner = saved["learner"]
        self.learner_label = saved["learner_label"]
        self.target = saved["target"]
        self.features = list(saved["features"])
        self.classes = list(saved["classes"])
        self.preprocessing = saved["preprocessing"]
        self.majority = saved["majority"]
        self.model = saved["model"]

    def prepare(self, frame):
        """Apply the training-time preprocessing: category codes and median imputation."""
        missing = [f for f in self.features if f not in frame]
        if missing:
            raise ValueError("Missing columns: " + ", ".join(missing))
        X = np.zeros((len(frame), len(self.features)))
        for j, p in enumerate(self.preprocessing):
            col = frame[p["name"]]
            if p["kind"] == "categorical":
                codes = {c: i for i, c in enumerate(p["categories"])}
                X[:, j] = col.map(lambda v: codes.get("(missing)" if pd.isna(v) else str(v), -1)).to_numpy()
            else:
                X[:, j] = pd.to_numeric(col, errors="coerce").fillna(p["median"]).to_numpy()
        return pd.DataFrame(X, columns=self.features)

    def predict(self, frame):
        """Predicted labels. Rows that fire no rule take the training majority class, as in the app."""
        df = self.prepare(frame)
        pred = np.asarray(self.model.predict(df)).astype(object)
        pred[self._no_rule(df)] = self.majority
        return pred.astype(str)

    def _no_rule(self, df):
        m = self.model
        if self.learner == "FERL":
            return np.asarray(m.firing_strength(df), float) <= 1e-12
        if self.learner in ("RuleMineClassifier", "RuleFineTuneClassifier"):
            inner = m.fl_classifier2_ if hasattr(m, "fl_classifier2_") else m.fl_classifier_
            fire = np.asarray(inner.rule_base.compute_firing_strenghts(df.to_numpy()), float)
            return fire.max(axis=1) <= 1e-12 if fire.size else np.ones(len(df), bool)
        return np.all(np.asarray(m._scores(df), float) == 0, axis=1)

    def print_rules(self):
        if self.learner == "FERL":
            self.model.print_tree()
        elif self.learner in ("RuleMineClassifier", "RuleFineTuneClassifier"):
            inner = self.model.fl_classifier2_ if hasattr(self.model, "fl_classifier2_") else self.model.fl_classifier_
            inner.rule_base.print_rules()
        else:
            self.model.print_rules()


def load_model(path="model.pkl"):
    with open(path, "rb") as fh:
        saved = pickle.load(fh)
    if not isinstance(saved, dict) or saved.get("format") != "exfuzzy-lab-model/1":
        raise ValueError("Not an exFuzzy Lab model file.")
    return SavedModel(saved)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python load_model.py new_rows.csv")
    source = Path(sys.argv[1])
    model = load_model(Path(__file__).with_name("model.pkl"))
    frame = pd.read_csv(source)
    labels = model.predict(frame)
    out = frame.copy()
    out["predicted_" + model.target] = labels
    dest = source.with_suffix(".predictions.csv")
    out.to_csv(dest, index=False)
    print(f"{model.learner_label}: predicted {len(labels)} rows -> {dest}")
    if model.target in frame:
        actual = frame[model.target].astype(str).to_numpy()
        print(f"accuracy against '{model.target}': {np.mean(actual == labels):.4f}")
