"""Minimal, dependency-free (numpy only) classification metrics — avoids adding scikit-learn for a handful of well-defined formulas. Every function here is a standard, published metric definition, not an invented score."""
import numpy as np


def confusion_matrix(y_true: np.ndarray, y_pred: np.ndarray, num_classes: int) -> np.ndarray:
    cm = np.zeros((num_classes, num_classes), dtype=np.int64)
    for t, p in zip(y_true, y_pred):
        cm[t, p] += 1
    return cm


def per_class_prf(cm: np.ndarray) -> list[dict]:
    num_classes = cm.shape[0]
    results = []
    for c in range(num_classes):
        tp = cm[c, c]
        fp = cm[:, c].sum() - tp
        fn = cm[c, :].sum() - tp
        support = cm[c, :].sum()
        precision = tp / (tp + fp) if (tp + fp) > 0 else None
        recall = tp / (tp + fn) if (tp + fn) > 0 else None
        f1 = (2 * precision * recall / (precision + recall)) if precision and recall and (precision + recall) > 0 else None
        results.append({"classIndex": c, "support": int(support), "precision": precision, "recall": recall, "f1": f1})
    return results


def classification_report(y_true: np.ndarray, y_pred: np.ndarray, num_classes: int) -> dict:
    cm = confusion_matrix(y_true, y_pred, num_classes)
    per_class = per_class_prf(cm)
    accuracy = float((y_true == y_pred).mean()) if len(y_true) > 0 else None

    present_classes = [c for c in per_class if c["support"] > 0]
    per_class_recall = [c["recall"] for c in present_classes if c["recall"] is not None]
    balanced_accuracy = float(np.mean(per_class_recall)) if per_class_recall else None

    f1_values = [c["f1"] for c in present_classes if c["f1"] is not None]
    macro_f1 = float(np.mean(f1_values)) if f1_values else None

    absent_classes = [c["classIndex"] for c in per_class if c["support"] == 0]

    return {
        "sampleCount": int(len(y_true)),
        "accuracy": accuracy,
        "balancedAccuracy": balanced_accuracy,
        "macroF1": macro_f1,
        "perClass": per_class,
        "confusionMatrix": cm.tolist(),
        "classesAbsentFromEvaluation": absent_classes,
    }
