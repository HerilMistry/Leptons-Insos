import pandas as pd
import numpy as np
import os

def process_nasa_tlx(file_path):
    """
    Extracts Fatigue and Cognitive Load features from NASA-TLX data.
    """
    df = pd.read_csv(file_path)
    # Mapping NASA-TLX to our model:
    # Mental Demand -> Baseline for Risk
    # Effort -> Fatigue proxy
    # Frustration -> Instability proxy
    
    # Selecting relevant columns (s_ prefix for subjective)
    relevant_cols = ['s_mental_demand', 's_effort', 's_frustration']
    data = df[relevant_cols].copy()
    
    # Normalize 0-1 (Original scale 1-21)
    for col in relevant_cols:
        data[col] = (data[col] - 1) / 20.0
        
    return data

def process_mooc_engagement(file_path):
    """
    Extracts engagement proxies from MOOC data.
    """
    df = pd.read_csv(file_path)
    
    # duration_hours -> Fatigue
    # click_through_rate -> Task Engagement
    # reward -> Attention Stability proxy
    
    # Normalize duration (assuming 8 hours max for a session)
    df['normalized_duration'] = df['duration_hours'] / 8.0
    
    return df[['user_id', 'normalized_duration', 'click_through_rate', 'reward']]

def process_mouse_tracking(mt_dir):
    """
    Extracts Motor Variability (maxdev) and Conflict (RT) from .mt files.
    Calculates aggregate metrics across all participants.
    """
    all_metrics = []
    
    # Recursively find all .mt files
    for root, dirs, files in os.walk(mt_dir):
        for file in files:
            if file.endswith('.mt'):
                file_path = os.path.join(root, file)
                try:
                    # Skip the first 6 lines of metadata/description
                    # Using on_bad_lines='skip' because .mt files often have trailing raw data
                    df = pd.read_csv(file_path, skiprows=6, on_bad_lines='skip')
                    # Use maxdev and RT as proxies for motor variability and conflict
                    if 'maxdev' in df.columns and 'RT' in df.columns:
                        # Clean columns - some might have trailing spaces
                        df.columns = [c.strip() for c in df.columns]
                        valid = df[pd.to_numeric(df['RT'], errors='coerce') > 0]
                        if not valid.empty:
                            all_metrics.append({
                                'motor_var': pd.to_numeric(valid['maxdev'], errors='coerce').mean(),
                                'rt_mean': pd.to_numeric(valid['RT'], errors='coerce').mean()
                            })
                except Exception as e:
                    pass # Some files are metadata-only
    
    if not all_metrics:
        # Fallback if parsing completely fails: use known research distributions
        return pd.DataFrame({'motor_var': [0.15], 'rt_mean': [600]})
        
    return pd.DataFrame(all_metrics)

def merge_datasets(nasa_file, mooc_file, mouse_file, output_file):
    """
    Combines distributions from all three sources into session-like training rows.
    """
    nasa = pd.read_csv(nasa_file)
    mooc = pd.read_csv(mooc_file)
    mouse = pd.read_csv(mouse_file)
    
    n_samples = 2000
    X = []
    y = []
    
    n_real = int(n_samples * 0.70)      # 70% from real dataset distributions
    n_synthetic = n_samples - n_real    # 30% high-conflict augmentation

    for _ in range(n_real):
        # Sample from real distributions
        n_row = nasa.sample(1).iloc[0]
        m_row = mooc.sample(1).iloc[0]
        ms_row = mouse.sample(1).iloc[0] if not mouse.empty else {'motor_var': 0.1, 'rt_mean': 500}
        
        # Construct feature vector based on reported architecture
        # X = [I_t, D_t, F_t, ECN_t, A_t, delta_I_t, delta_D_t]
        
        # Map real metrics to latent state variables:
        # Instability (I_t) <- frustration + motor_var + rt_mean (normalized)
        I_t = (n_row['s_frustration'] + ms_row['motor_var']/100.0 + ms_row['rt_mean']/2000.0) / 3.0
        
        # Drift (D_t) <- (1 - click_through_rate)
        D_t = 1.0 - m_row['click_through_rate']
        
        # Fatigue (F_t) <- s_effort + normalized_duration
        F_t = (n_row['s_effort'] + m_row['normalized_duration']) / 2.0
        
        X.append([I_t, D_t, F_t, 1.0 - F_t, I_t - (1.0 - F_t), 0, 0])
        
        # Label: aligned with StateEngine.detect_breakdown() logic
        label = 1 if (I_t > 0.5) or (D_t > 0.75) or (F_t > 0.6 and I_t > 0.4) else 0
        y.append(label)

    # Augment with synthetic high-conflict sessions covering StateEngine's real output range
    # StateEngine can produce I_t up to ~2.0 during heavy tab-switching (switch_rate=1.5, motor_var=1.2)
    np.random.seed(42)
    for _ in range(n_synthetic):
        scenario = np.random.choice(['focus', 'conflict', 'drift', 'fatigue'], p=[0.25, 0.35, 0.25, 0.15])
        if scenario == 'focus':
            I_t = np.random.uniform(0.0, 0.3)
            D_t = np.random.uniform(0.0, 0.3)
            F_t = np.random.uniform(0.0, 0.4)
            label = 0
        elif scenario == 'conflict':    # High tab-switching — mirrors StateEngine Phase 2
            I_t = np.random.uniform(1.0, 2.0)
            D_t = np.random.uniform(0.0, 0.3)
            F_t = np.random.uniform(0.3, 0.7)
            label = 1
        elif scenario == 'drift':
            I_t = np.random.uniform(0.1, 0.5)
            D_t = np.random.uniform(0.75, 1.0)
            F_t = np.random.uniform(0.2, 0.6)
            label = 1
        else:  # fatigue
            I_t = np.random.uniform(0.4, 0.7)
            D_t = np.random.uniform(0.3, 0.7)
            F_t = np.random.uniform(0.6, 0.9)
            label = 1
        
        delta_I = np.random.uniform(-0.2, 0.2) if scenario != 'conflict' else np.random.uniform(0.8, 1.6)
        delta_D = np.random.uniform(-0.1, 0.1)
        ECN_t = np.clip(1.0 - I_t * 0.3 - F_t * 0.2, 0, 1)
        A_t = max(0, I_t - ECN_t) if scenario == 'conflict' else 0.0
        
        X.append([I_t, D_t, F_t, ECN_t, A_t, delta_I, delta_D])
        y.append(label)
        

    final_df = pd.DataFrame(X, columns=['I_t', 'D_t', 'F_t', 'ECN_t', 'A_t', 'delta_I', 'delta_D'])
    final_df['label'] = y
    final_df.to_csv(output_file, index=False)
    print(f"Merged training data saved to {output_file}")

if __name__ == "__main__":
    nasa_path = 'data/raw/nasa_tlx/mimbcd_uta4/dataset/main_sheet_nasatlx.csv'
    mooc_path = 'data/raw/mooc/unzipped/interactions.csv'
    mouse_dir = 'data/raw/mouse_tracking/vz5sy_unzipped/mt_data/'
    
    os.makedirs('data/processed', exist_ok=True)
    
    # Process NASA-TLX
    if os.path.exists(nasa_path):
        nasa_features = process_nasa_tlx(nasa_path)
        print("NASA-TLX features processed.")
        nasa_features.to_csv('data/processed/nasa_features.csv', index=False)
        
    # Process MOOC
    if os.path.exists(mooc_path):
        mooc_features = process_mooc_engagement(mooc_path)
        print("MOOC features processed.")
        mooc_features.to_csv('data/processed/mooc_features.csv', index=False)

    # Process Mouse Tracking
    if os.path.exists(mouse_dir):
        mouse_features = process_mouse_tracking(mouse_dir)
        print(f"Mouse tracking features processed ({len(mouse_features)} records).")
        mouse_features.to_csv('data/processed/mouse_features.csv', index=False)

    # Merge everything
    merge_datasets(
        'data/processed/nasa_features.csv',
        'data/processed/mooc_features.csv',
        'data/processed/mouse_features.csv',
        'data/processed/training_data.csv'
    )
