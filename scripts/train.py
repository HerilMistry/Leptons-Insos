import numpy as np
import pandas as pd
import sys
import os

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from cortex_core.predictor import CortexPredictor

def main():
    training_file = 'data/processed/training_data.csv'
    if not os.path.exists(training_file):
        print(f"Error: {training_file} not found. Run scripts/preprocess.py first.")
        return
    print(f"Loading training data from {training_file}...")
    df = pd.read_csv(training_file)
    X = df.drop('label', axis=1).values
    y = df['label'].values
    print(f"Training on {len(X)} samples. Positive class: {sum(y)} ({sum(y)/len(y):.2%})")
    predictor = CortexPredictor(model_path='models/baseline_model.joblib')
    os.makedirs('models', exist_ok=True)
    predictor.train(X, y)
    print("Training complete. Model saved to models/baseline_model.joblib")

if __name__ == "__main__":
    main()
