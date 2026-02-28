import React, { createContext, useContext, useState, useCallback } from "react";

export interface CognitiveState {
  ECN: number;
  instability: number;
  drift: number;
  fatigue: number;
  risk: number;
}

interface CognitiveStateContextType {
  cognitiveState: CognitiveState | null;
  setCognitiveState: (state: CognitiveState | null) => void;
}

const CognitiveStateContext = createContext<CognitiveStateContextType>({
  cognitiveState: null,
  setCognitiveState: () => {},
});

export function CognitiveStateProvider({ children }: { children: React.ReactNode }) {
  const [cognitiveState, setCognitiveStateRaw] = useState<CognitiveState | null>(null);
  const setCognitiveState = useCallback((s: CognitiveState | null) => setCognitiveStateRaw(s), []);
  return (
    <CognitiveStateContext.Provider value={{ cognitiveState, setCognitiveState }}>
      {children}
    </CognitiveStateContext.Provider>
  );
}

export function useCognitiveState() {
  return useContext(CognitiveStateContext);
}
