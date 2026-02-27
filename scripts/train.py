import numpy as np
import pandas as pd
import sys
import os

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from cortex_core.predictor import CortexPredictor
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score


def main():
    training_file = 'data/processed/training_data.csv'
    if not os.path.exists(training_file):
        print(f"Error: {training_file} not found. Run scripts/preprocess.py first.")
        return

    print(f"Loading training data from {training_file}...")
    df = pd.read_csv(training_file)
    X = df.drop('label', axis=1).values
    y = df['label'].values
    print(f"  {len(X)} samples | positive: {sum(y)} ({sum(y)/len(y):.1%})")
    print(f"  delta_I range: [{X[:,5].min():.4f}, {X[:,5].max():.4f}]")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )
    cv = StratifiedKFold(5, shuffle=True, random_state=42)
    os.makedirs('models', exist_ok=True)

    # --- XGBoost (primary) ---
    try:
        from xgboost import XGBClassifier
        from sklearn.metrics import f1_score as sk_f1
        neg, pos = sum(y == 0), sum(y == 1)
        xgb = XGBClassifier(
            n_estimators=200, max_depth=4, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8,
            scale_pos_weight=neg / pos,          # handles class imbalance
            eval_metric='logloss', random_state=42, verbosity=0
        )
        xgb.fit(X_train, y_train)
        xgb_f1 = cross_val_score(xgb, X, y, cv=cv, scoring='f1').mean()
        test_f1 = sk_f1(y_test, xgb.predict(X_test))
        print(f"\nXGBoost  — CV F1: {xgb_f1:.4f} | Test F1: {test_f1:.4f}")

        import joblib
        joblib.dump(xgb, 'models/baseline_model.joblib')
        print("XGBoost model saved to models/baseline_model.joblib")

    except ImportError:
        print("XGBoost not installed — falling back to Logistic Regression.")
        print("Install with: pip install xgboost")

        predictor = CortexPredictor(model_path='models/baseline_model.joblib')
        predictor.train(X_train, y_train)
        print("Logistic Regression model saved to models/baseline_model.joblib")


if __name__ == "__main__":
    main()
