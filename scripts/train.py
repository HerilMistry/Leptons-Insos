import numpy as np
import pandas as pd
import sys
import os
import joblib

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sklearn.model_selection import GroupKFold, cross_val_score
from sklearn.metrics import f1_score as sk_f1, accuracy_score, classification_report
from xgboost import XGBClassifier

def main():
    training_file = 'data/processed/training_data.csv'
    if not os.path.exists(training_file):
        print(f"Error: {training_file} not found. Run scripts/preprocess.py first.")
        return

    print(f"Loading training data from {training_file}...")
    df        = pd.read_csv(training_file)
    groups    = df['session_id'].values        # for LOSO-CV
    X         = df.drop(['label', 'session_id'], axis=1).values
    y         = df['label'].values
    print(f"  {len(X)} samples | {len(np.unique(groups))} sessions | "
          f"positive: {sum(y)} ({sum(y)/len(y):.1%})")

    os.makedirs('models', exist_ok=True)

    neg, pos = sum(y == 0), sum(y == 1)
    xgb = XGBClassifier(
        n_estimators=300, max_depth=5, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8,
        min_child_weight=3, gamma=0.1,
        scale_pos_weight=neg / pos,
        eval_metric='logloss', random_state=42, verbosity=0
    )

    # Leave-One-Session-Out CV (GroupKFold) — no intra-session leakage
    print("\nRunning Leave-One-Session-Out (LOSO) cross-validation...")
    gkf    = GroupKFold(n_splits=5)
    
    cv_f1  = cross_val_score(xgb, X, y, groups=groups, cv=gkf, scoring='f1').mean()
    cv_acc = cross_val_score(xgb, X, y, groups=groups, cv=gkf, scoring='accuracy').mean()
    cv_auc = cross_val_score(xgb, X, y, groups=groups, cv=gkf, scoring='roc_auc').mean()

    print(f"  LOSO Accuracy : {cv_acc:.4f}")
    print(f"  LOSO F1       : {cv_f1:.4f}")
    print(f"  LOSO ROC-AUC  : {cv_auc:.4f}")

    # Final fit on full dataset
    xgb.fit(X, y)
    joblib.dump(xgb, 'models/baseline_model.joblib')
    print("\nFinal XGBoost model saved to models/baseline_model.joblib")

if __name__ == "__main__":
    main()
