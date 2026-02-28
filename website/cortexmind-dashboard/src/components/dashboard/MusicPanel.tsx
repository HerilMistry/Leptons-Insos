import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import { useCognitiveState, type CognitiveState } from "@/context/CognitiveStateContext";

/* ───── constants ───── */

const GROQ_API_KEY = (import.meta.env?.VITE_GROQ_API_KEY ?? "") as string;

const TRACKS = [
  {
    id: 1,
    name: "40Hz Gamma Focus",
    artist: "Binaural Beats",
    query: "40hz gamma binaural beats focus",
    emoji: "🔵",
    neuroLabel: "ECN Activation",
    neuroReason:
      "40Hz gamma oscillations are associated with neural binding and prefrontal engagement. Supports ECN re-activation when executive control is low.",
    targetState: "low_ecn",
    color: "#6366f1",
  },
  {
    id: 2,
    name: "Alpha Wave Flow",
    artist: "Neural Ambient",
    query: "alpha waves study ambient music",
    emoji: "🟢",
    neuroLabel: "SN Dampening",
    neuroReason:
      "Alpha waves (8-12Hz) reduce Salience Network reactivity, dampening the ACC conflict signals that cause impulsive tab-switching.",
    targetState: "high_instability",
    color: "#22c55e",
  },
  {
    id: 3,
    name: "Bach Deep Work",
    artist: "Classical Focus",
    query: "bach classical piano concentration",
    emoji: "🟣",
    neuroLabel: "DMN Suppression",
    neuroReason:
      "Structured classical music with predictable harmonic patterns suppresses Default Mode Network activity, reducing mind-wandering episodes.",
    targetState: "high_drift",
    color: "#8b5cf6",
  },
  {
    id: 4,
    name: "Brown Noise Rest",
    artist: "Cognitive Recovery",
    query: "brown noise deep focus",
    emoji: "🟠",
    neuroLabel: "Fatigue Buffer",
    neuroReason:
      "Brown noise masks environmental distractors at a frequency profile that reduces cognitive load, ideal when executive resources are depleted.",
    targetState: "high_fatigue",
    color: "#f59e0b",
  },
];

type Track = (typeof TRACKS)[number];

/* ───── MusicPanel ───── */

const MusicPanel = memo(function MusicPanel() {
  const { cognitiveState } = useCognitiveState();

  const [isOpen, setIsOpen] = useState(false);
  const [volume, setVolume] = useState(70);
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingTrack, setLoadingTrack] = useState<number | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<{ trackId: number; shortReason: string } | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [hoveredTooltip, setHoveredTooltip] = useState<number | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const activeNodesRef = useRef<AudioNode[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  /* close on outside click */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  /* cleanup audio on unmount */
  useEffect(() => {
    return () => {
      activeNodesRef.current.forEach((n) => {
        try { if ("stop" in n) (n as OscillatorNode).stop(); } catch { /* already stopped */ }
        n.disconnect();
      });
      activeNodesRef.current = [];
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
    };
  }, []);

  /* fetch Groq suggestion when panel opens */
  const fetchSuggestion = useCallback(
    async (cs: CognitiveState) => {
      if (!GROQ_API_KEY) return;
      setLoadingSuggestion(true);
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            max_tokens: 120,
            messages: [
              {
                role: "system",
                content: `You are a neuroscience-based music advisor. Given cognitive state values, pick ONE track from this list and give a short reason (max 55 chars).
Tracks:
1. "40Hz Gamma Focus" - for low ECN (ECN < 0.5)
2. "Alpha Wave Flow" - for high instability (> 0.55)
3. "Bach Deep Work" - for high drift (> 0.55)
4. "Brown Noise Rest" - for high fatigue (> 0.6)
Respond ONLY with JSON: {"trackId": 1, "shortReason": "Your ECN needs a boost right now"}`,
              },
              {
                role: "user",
                content: `ECN: ${cs.ECN?.toFixed(2)}, instability: ${cs.instability?.toFixed(2)}, drift: ${cs.drift?.toFixed(2)}, fatigue: ${cs.fatigue?.toFixed(2)}, risk: ${cs.risk?.toFixed(2)}`,
              },
            ],
          }),
        });
        const data = await res.json();
        const text = data.choices[0].message.content;
        const clean = text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        setSuggestion(parsed);
      } catch {
        setSuggestion(null);
      } finally {
        setLoadingSuggestion(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (isOpen && cognitiveState && (cognitiveState.ECN > 0 || cognitiveState.instability > 0)) {
      fetchSuggestion(cognitiveState);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  /* ── Web Audio generators ── */

  const stopAllNodes = useCallback(() => {
    activeNodesRef.current.forEach((n) => {
      try { if ("stop" in n) (n as OscillatorNode).stop(); } catch { /* already stopped */ }
      n.disconnect();
    });
    activeNodesRef.current = [];
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
      gainRef.current = null;
    }
  }, []);

  /** Create binaural beat: left ear = baseHz, right ear = baseHz + beatHz */
  const startBinaural = useCallback(
    (ctx: AudioContext, gain: GainNode, baseHz: number, beatHz: number) => {
      const merger = ctx.createChannelMerger(2);
      const oscL = ctx.createOscillator();
      oscL.type = "sine";
      oscL.frequency.value = baseHz;
      const oscR = ctx.createOscillator();
      oscR.type = "sine";
      oscR.frequency.value = baseHz + beatHz;
      oscL.connect(merger, 0, 0);
      oscR.connect(merger, 0, 1);
      merger.connect(gain);
      oscL.start();
      oscR.start();
      return [oscL, oscR, merger];
    },
    [],
  );

  /** Warm ambient Cmaj7 pad with slight detune for chorusing */
  const startAmbientPad = useCallback(
    (ctx: AudioContext, gain: GainNode) => {
      const freqs = [130.81, 164.81, 196.0, 246.94]; // C3 E3 G3 B3
      const nodes: AudioNode[] = [];
      freqs.forEach((freq) => {
        const osc1 = ctx.createOscillator();
        osc1.type = "sine";
        osc1.frequency.value = freq;
        const osc2 = ctx.createOscillator();
        osc2.type = "sine";
        osc2.frequency.value = freq * 1.003; // warm detuned chorus
        const sub = ctx.createGain();
        sub.gain.value = 0.09;
        osc1.connect(sub);
        osc2.connect(sub);
        sub.connect(gain);
        osc1.start();
        osc2.start();
        nodes.push(osc1, osc2, sub);
      });
      return nodes;
    },
    [],
  );

  /** Brown noise via looped pre-generated AudioBuffer */
  const startBrownNoise = useCallback(
    (ctx: AudioContext, gain: GainNode) => {
      const dur = 4; // seconds of noise, then loop
      const len = ctx.sampleRate * dur;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(gain);
      src.start();
      return [src];
    },
    [],
  );

  /* play logic */
  const handleTrackClick = useCallback(
    async (track: Track) => {
      /* toggle play / pause for already-active track */
      if (activeTrack?.id === track.id && audioCtxRef.current) {
        if (isPlaying) {
          await audioCtxRef.current.suspend();
          setIsPlaying(false);
        } else {
          await audioCtxRef.current.resume();
          setIsPlaying(true);
        }
        return;
      }

      /* tear down previous track */
      stopAllNodes();

      setActiveTrack(track);
      setIsPlaying(false);
      setLoadingTrack(track.id);
      setTrackError(null);

      try {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const gain = ctx.createGain();
        gain.gain.value = volume / 100;
        gain.connect(ctx.destination);
        gainRef.current = gain;

        let nodes: AudioNode[] = [];

        if (track.id === 1) {
          /* 40 Hz gamma binaural beat (200 Hz left, 240 Hz right) */
          nodes = startBinaural(ctx, gain, 200, 40);
        } else if (track.id === 2) {
          /* 10 Hz alpha binaural beat (200 Hz left, 210 Hz right) */
          nodes = startBinaural(ctx, gain, 200, 10);
        } else if (track.id === 3) {
          /* Warm ambient Cmaj7 pad */
          nodes = startAmbientPad(ctx, gain);
        } else if (track.id === 4) {
          /* Brown noise */
          nodes = startBrownNoise(ctx, gain);
        }

        activeNodesRef.current = nodes;
        setIsPlaying(true);
      } catch {
        setTrackError("Could not start audio. Please try again.");
        setActiveTrack(null);
      } finally {
        setLoadingTrack(null);
      }
    },
    [activeTrack, isPlaying, volume, stopAllNodes, startBinaural, startAmbientPad, startBrownNoise],
  );

  const handleStop = useCallback(() => {
    stopAllNodes();
    setActiveTrack(null);
    setIsPlaying(false);
  }, [stopAllNodes]);

  const handleVolumeChange = useCallback((val: number) => {
    setVolume(val);
    if (gainRef.current) gainRef.current.gain.value = val / 100;
  }, []);

  const hasCogState = cognitiveState && (cognitiveState.ECN > 0 || cognitiveState.instability > 0);

  return (
    <div style={{ position: "relative" }}>
      <style>{`
        @keyframes mp-slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes mp-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes mp-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes mp-shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      {/* ── TOPBAR BUTTON ── */}
      <button
        ref={btnRef}
        onClick={() => setIsOpen((o) => !o)}
        style={{
          position: "relative",
          background: isPlaying ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.05)",
          border: `1px solid ${isPlaying ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)"}`,
          borderRadius: 8,
          padding: "7px 10px",
          cursor: "pointer",
          color: isPlaying ? "#a5b4fc" : "rgba(255,255,255,0.45)",
          transition: "all 0.15s",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 0,
        }}
      >
        {/* Music2 icon inline SVG to avoid import issues */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="8" cy="18" r="4" />
          <path d="M12 18V2l7 4" />
        </svg>
        {isPlaying && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#22c55e",
              animation: "mp-pulse 1.5s ease infinite",
            }}
          />
        )}
      </button>

      {/* ── PANEL ── */}
      {isOpen && (
        <div
          ref={panelRef}
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 320,
            zIndex: 9999,
            background: "#0d0f14",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            padding: 16,
            animation: "mp-slideDown 0.2s ease",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>🧠 Neural Audio</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>🎧 Use headphones</span>
          </div>

          {/* Suggestion */}
          {!hasCogState ? (
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.3)",
                padding: "10px 0",
                textAlign: "center",
              }}
            >
              Start a session to get a personalized recommendation
            </div>
          ) : loadingSuggestion ? (
            <div
              style={{
                height: 52,
                borderRadius: 8,
                margin: "10px 0",
                background:
                  "linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 100%)",
                backgroundSize: "200% 100%",
                animation: "mp-shimmer 1.5s infinite",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                color: "rgba(255,255,255,0.3)",
              }}
            >
              Analyzing your cognitive state…
            </div>
          ) : suggestion ? (
            <div
              style={{
                background: "rgba(99,102,241,0.08)",
                border: "1px solid rgba(99,102,241,0.2)",
                borderLeft: "3px solid #6366f1",
                borderRadius: 8,
                padding: "10px 12px",
                margin: "10px 0",
              }}
            >
              <div style={{ fontSize: 9, textTransform: "uppercase", color: "#a5b4fc", letterSpacing: 0.5, marginBottom: 3 }}>
                ⚡ Suggested for you
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>
                {TRACKS.find((t) => t.id === suggestion.trackId)?.name ?? "Track"}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                {suggestion.shortReason?.slice(0, 60)}
              </div>
            </div>
          ) : null}

          {/* Track list */}
          <div style={{ marginTop: 6 }}>
            {TRACKS.map((track) => {
              const isActive = activeTrack?.id === track.id;
              const isSuggested = suggestion?.trackId === track.id;
              const isLoading = loadingTrack === track.id;
              return (
                <div
                  key={track.id}
                  onClick={() => handleTrackClick(track)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: 10,
                    cursor: "pointer",
                    transition: "background 0.15s",
                    marginBottom: 4,
                    position: "relative",
                    background: isActive ? `${track.color}1a` : "transparent",
                    border: isActive ? `1px solid ${track.color}40` : "1px solid transparent",
                    borderLeft: isSuggested ? `2px solid #6366f1` : isActive ? `1px solid ${track.color}40` : "1px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {/* emoji */}
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{track.emoji}</span>

                  {/* info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: isActive ? track.color : "rgba(255,255,255,0.8)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {track.name}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", gap: 4 }}>
                      {track.artist}
                      <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
                      <span style={{ color: track.color }}>{track.neuroLabel}</span>
                    </div>
                  </div>

                  {/* play / pause / loading */}
                  <div style={{ flexShrink: 0, width: 20, display: "flex", justifyContent: "center" }}>
                    {isLoading ? (
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          border: "2px solid rgba(255,255,255,0.1)",
                          borderTop: `2px solid ${track.color}`,
                          borderRadius: "50%",
                          animation: "mp-spin 0.6s linear infinite",
                        }}
                      />
                    ) : isActive && isPlaying ? (
                      <div style={{ display: "flex", gap: 2 }}>
                        <div style={{ width: 3, height: 14, borderRadius: 1, background: track.color }} />
                        <div style={{ width: 3, height: 14, borderRadius: 1, background: track.color }} />
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>▶</span>
                    )}
                  </div>

                  {/* neuro info tooltip */}
                  <div
                    style={{ flexShrink: 0, position: "relative", cursor: "default" }}
                    onMouseEnter={(e) => { e.stopPropagation(); setHoveredTooltip(track.id); }}
                    onMouseLeave={() => setHoveredTooltip(null)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>ℹ</span>
                    {hoveredTooltip === track.id && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: "calc(100% + 6px)",
                          right: 0,
                          width: 200,
                          background: "#1a1d24",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 8,
                          padding: "8px 10px",
                          fontSize: 10,
                          color: "rgba(255,255,255,0.6)",
                          lineHeight: 1.5,
                          zIndex: 99999,
                          pointerEvents: "none",
                        }}
                      >
                        {track.neuroReason}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Error */}
          {trackError && (
            <div style={{ color: "#ef4444", fontSize: 11, padding: "6px 0" }}>{trackError}</div>
          )}

          {/* Volume */}
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Volume</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{volume}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#6366f1", height: 3, cursor: "pointer" }}
            />
          </div>

          {/* Now playing footer */}
          {activeTrack && (
            <>
              <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.06)", margin: "10px 0 8px" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                    {activeTrack.emoji} Now playing
                  </span>
                  <span
                    style={{ fontSize: 11, fontWeight: 600, color: activeTrack.color, marginLeft: 6 }}
                  >
                    {activeTrack.name}
                  </span>
                </div>
                <button
                  onClick={handleStop}
                  style={{
                    background: "none",
                    border: "none",
                    color: "rgba(255,255,255,0.35)",
                    cursor: "pointer",
                    fontSize: 14,
                    padding: "2px 6px",
                    lineHeight: 1,
                  }}
                  title="Stop"
                >
                  ■
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
});

export default MusicPanel;
