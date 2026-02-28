/**
 * Focus Exercise — 60-second guided breathing overlay
 * Uses requestAnimationFrame for the breathing circle animation.
 */

import { useState, useEffect, useRef, useCallback } from "react";

interface FocusExerciseProps {
  onComplete: () => void;
  onCancel: () => void;
}

// Breathing phases (seconds)
const INHALE = 4;
const HOLD = 4;
const EXHALE = 6;
const CYCLE = INHALE + HOLD + EXHALE; // 14 s
const TOTAL_DURATION = 60; // seconds

function getPhaseInfo(elapsed: number): { label: string; scale: number } {
  const inCycle = elapsed % CYCLE;

  if (inCycle < INHALE) {
    // Inhale — circle grows 1.0 → 1.6
    const t = inCycle / INHALE;
    return { label: "Breathe in…", scale: 1.0 + 0.6 * t };
  }
  if (inCycle < INHALE + HOLD) {
    // Hold — stays at 1.6
    return { label: "Hold…", scale: 1.6 };
  }
  // Exhale — circle shrinks 1.6 → 1.0
  const t = (inCycle - INHALE - HOLD) / EXHALE;
  return { label: "Breathe out…", scale: 1.6 - 0.6 * t };
}

export default function FocusExercise({ onComplete, onCancel }: FocusExerciseProps) {
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_DURATION);
  const [phase, setPhase] = useState({ label: "Breathe in…", scale: 1.0 });
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  const tick = useCallback((now: number) => {
    if (!startRef.current) startRef.current = now;
    const elapsed = (now - startRef.current) / 1000;
    const remaining = Math.max(0, TOTAL_DURATION - elapsed);
    setSecondsLeft(Math.ceil(remaining));
    setPhase(getPhaseInfo(elapsed));

    if (remaining <= 0) {
      onComplete();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [onComplete]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md select-none">
      {/* Close button */}
      <button
        onClick={onCancel}
        className="absolute top-6 right-8 text-white/50 hover:text-white text-2xl"
        aria-label="Cancel focus exercise"
      >
        ✕
      </button>

      {/* Title */}
      <p className="text-indigo-300 text-sm tracking-widest uppercase mb-8">
        Rebuilding Executive Control…
      </p>

      {/* Breathing circle */}
      <div className="relative flex items-center justify-center mb-10">
        <div
          className="rounded-full bg-gradient-to-br from-indigo-500/40 to-violet-600/30 border border-indigo-400/30 flex items-center justify-center"
          style={{
            width: 180,
            height: 180,
            transform: `scale(${phase.scale})`,
            transition: "transform 0.3s ease-out",
          }}
        >
          <span className="text-white text-lg font-medium">{phase.label}</span>
        </div>
      </div>

      {/* Timer */}
      <p className="text-4xl font-bold text-white tabular-nums tracking-widest">
        {secondsLeft}s
      </p>

      <p className="text-white/40 text-xs mt-6">
        4 s inhale · 4 s hold · 6 s exhale
      </p>
    </div>
  );
}
