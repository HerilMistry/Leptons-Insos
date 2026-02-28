import { useState, useEffect, useMemo, useRef, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { getSessionHistory } from "@/api/sessions";
import type { Session } from "@/types/api";

/* ───── helpers ───── */

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fmtDuration(mins: number | null) {
  if (mins == null || mins <= 0) return "—";
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const taskEmoji: Record<string, string> = {
  Coding: "💻",
  Writing: "✍️",
  Reading: "📖",
  Watching: "🎬",
  Research: "🔬",
};

/* ───── component ───── */

export default function ProfilePage() {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();

  /* user state */
  const fallback = {
    name: "Your Name",
    email: "you@example.com",
    joinedDate: "Feb 2026",
    taskPreference: "Coding",
  };

  const [name, setName] = useState(authUser?.name ?? fallback.name);
  const [email, setEmail] = useState(authUser?.email ?? fallback.email);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const editNameRef = useRef(name);
  const editEmailRef = useRef(email);

  /* sessions fetch */
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getSessionHistory()
      .then((s) => { if (!cancelled) setSessions(s); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  /* computed stats */
  const stats = useMemo(() => {
    const total = sessions.length;
    const avgFocus = total
      ? sessions.reduce((a, s) => a + (s.deep_work_ratio ?? 0), 0) / total
      : 0;
    const avgInst = total
      ? sessions.reduce((a, s) => a + (s.avg_instability ?? 0), 0) / total
      : 0;
    const totalDeep = sessions.reduce(
      (a, s) => a + (s.deep_work_ratio ?? 0) * ((s.duration_minutes ?? 0)),
      0,
    );
    const totalFocusHrs = sessions.reduce((a, s) => a + (s.duration_minutes ?? 0), 0) / 60;
    const bestStreak = sessions.length
      ? Math.max(...sessions.map((s) => Math.max(1, Math.round(10 / Math.max(s.switch_count ?? 1, 1)))))
      : 0;

    return {
      totalSessions: total,
      avgFocusScore: Math.round(avgFocus * 100),
      avgInstability: Math.round(avgInst * 100),
      totalDeepWork: Math.round(totalDeep),
      totalFocusTime: totalFocusHrs.toFixed(1),
      bestStreak,
    };
  }, [sessions]);

  const recentSessions = useMemo(
    () =>
      [...sessions]
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
        .slice(0, 5),
    [sessions],
  );

  /* most used task */
  const taskPreference = useMemo(() => {
    if (!sessions.length) return "Coding";
    const counts: Record<string, number> = {};
    sessions.forEach((s) => { counts[s.task_type] = (counts[s.task_type] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }, [sessions]);

  /* photo handler */
  const onPhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      setPhotoError("JPEG or PNG only");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError("Max 2 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  /* edit handlers */
  const startEdit = () => {
    editNameRef.current = name;
    editEmailRef.current = email;
    setEditing(true);
  };
  const cancelEdit = () => {
    setName(editNameRef.current);
    setEmail(editEmailRef.current);
    setEditing(false);
  };
  const saveEdit = () => setEditing(false);

  /* stat card config */
  const statCards = [
    { icon: "🗓️", value: stats.totalSessions, label: "Sessions Completed", color: "#6366f1" },
    { icon: "⏱️", value: `${stats.totalFocusTime}h`, label: "Total Focus Time", color: "#22c55e" },
    { icon: "🔬", value: `${stats.avgFocusScore}%`, label: "Avg Deep Work", color: "#8b5cf6" },
    { icon: "⚡", value: `${stats.avgInstability}%`, label: "Avg Instability", color: stats.avgInstability > 50 ? "#ef4444" : "#f59e0b" },
    { icon: "🧠", value: `${stats.totalDeepWork}m`, label: "Deep Work Earned", color: "#6366f1" },
    { icon: "🔥", value: `${stats.bestStreak} blocks`, label: "Best Attention Streak", color: "#f59e0b" },
  ];

  /* ─── render ─── */

  return (
    <AppLayout>
      <style>{`
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        .p-card { animation: cardIn 0.35s ease both; }
        .p-shimmer {
          background: linear-gradient(90deg,
            rgba(255,255,255,0.03) 0%,
            rgba(255,255,255,0.08) 50%,
            rgba(255,255,255,0.03) 100%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 12px;
        }
      `}</style>

      <div className="p-6 max-w-4xl mx-auto">

        {/* ════════ SECTION 1: PROFILE HEADER ════════ */}
        <div
          className="p-card"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16,
            padding: "28px 32px",
            display: "flex",
            alignItems: "center",
            gap: 28,
            flexWrap: "wrap",
          }}
        >
          {/* Photo */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
            {photo ? (
              <img
                src={photo}
                alt="avatar"
                width={88}
                height={88}
                style={{ borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(99,102,241,0.5)" }}
              />
            ) : (
              <div
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#fff",
                  userSelect: "none",
                }}
              >
                {getInitials(name)}
              </div>
            )}
            <label
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.3)",
                cursor: "pointer",
                marginTop: 6,
                textAlign: "center",
              }}
            >
              Change Photo
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={onPhotoChange}
                style={{ display: "none" }}
              />
            </label>
            {photoError && (
              <span style={{ fontSize: 10, color: "#ef4444", marginTop: 2 }}>{photoError}</span>
            )}
          </div>

          {/* Name + email */}
          <div style={{ flex: 1, minWidth: 180 }}>
            {editing ? (
              <>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 8,
                    padding: "6px 12px",
                    color: "#fff",
                    fontSize: 18,
                    fontWeight: 700,
                    width: "100%",
                    outline: "none",
                  }}
                />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 8,
                    padding: "5px 12px",
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 13,
                    width: "100%",
                    marginTop: 6,
                    outline: "none",
                  }}
                />
              </>
            ) : (
              <>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>{name}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{email}</div>
              </>
            )}

            {/* Pills */}
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: 10,
                  padding: "3px 10px",
                  borderRadius: 99,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                Member since {fallback.joinedDate}
              </span>
              <span
                style={{
                  fontSize: 10,
                  padding: "3px 10px",
                  borderRadius: 99,
                  background: "rgba(99,102,241,0.1)",
                  border: "1px solid rgba(99,102,241,0.2)",
                  color: "#a5b4fc",
                }}
              >
                {taskEmoji[taskPreference] ?? "🧠"} Prefers {taskPreference}
              </span>
            </div>
          </div>

          {/* Edit / Save / Cancel */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexShrink: 0 }}>
            {editing ? (
              <>
                <button
                  onClick={saveEdit}
                  style={{
                    background: "#6366f1",
                    border: "none",
                    color: "#fff",
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Save
                </button>
                <button
                  onClick={cancelEdit}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.5)",
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={startEdit}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.5)",
                  padding: "8px 16px",
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: "pointer",
                  transition: "border-color 0.2s, color 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.5)";
                }}
              >
                Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* ════════ SECTION 2: COGNITIVE STATS ════════ */}
        <div
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 1,
            color: "rgba(255,255,255,0.25)",
            marginTop: 32,
            marginBottom: 12,
          }}
        >
          Cognitive Stats
        </div>

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-shimmer" style={{ height: 90 }} />
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {statCards.map((c, i) => (
              <div
                key={c.label}
                className="p-card"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  padding: "16px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  animationDelay: `${i * 60}ms`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 18 }}>{c.icon}</span>
                  <span
                    style={{
                      fontSize: 9,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      color: "rgba(255,255,255,0.3)",
                    }}
                  >
                    {c.label}
                  </span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* ════════ SECTION 3: RECENT SESSIONS ════════ */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 32,
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "rgba(255,255,255,0.25)",
            }}
          >
            Recent Sessions
          </span>
          <span
            onClick={() => navigate("/session/history")}
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.3)",
              cursor: "pointer",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#a5b4fc"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
          >
            View All →
          </span>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-shimmer" style={{ height: 48 }} />
            ))}
          </div>
        ) : recentSessions.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 0",
              color: "rgba(255,255,255,0.2)",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>🧠</div>
            <div style={{ fontSize: 14 }}>No sessions yet</div>
            <div style={{ fontSize: 12, marginTop: 4, color: "rgba(255,255,255,0.15)" }}>
              Start your first session to see your history here
            </div>
          </div>
        ) : (
          recentSessions.map((s, i) => {
            const dwr = s.deep_work_ratio ?? 0;
            const dwPct = Math.round(dwr * 100);
            const inst = s.avg_instability ?? 0;
            const dwColor =
              dwPct >= 60 ? { bg: "rgba(34,197,94,0.1)", color: "#22c55e" }
              : dwPct >= 30 ? { bg: "rgba(245,158,11,0.1)", color: "#f59e0b" }
              : { bg: "rgba(239,68,68,0.1)", color: "#ef4444" };
            const instColor = inst > 0.6 ? "#ef4444" : inst > 0.4 ? "#f59e0b" : "#22c55e";

            return (
              <div
                key={s.id}
                className="p-card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "12px 16px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: 10,
                  marginBottom: 6,
                  animationDelay: `${i * 50}ms`,
                }}
              >
                {/* task */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 100 }}>
                  <span style={{ fontSize: 16 }}>{taskEmoji[s.task_type] ?? "🧠"}</span>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                    {s.task_type}
                  </span>
                </div>

                {/* date */}
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", minWidth: 120 }}>
                  {fmtDate(s.started_at)}
                </span>

                {/* duration */}
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", minWidth: 50 }}>
                  {fmtDuration(s.duration_minutes)}
                </span>

                {/* spacer */}
                <div style={{ flex: 1 }} />

                {/* deep work pill */}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 99,
                    background: dwColor.bg,
                    color: dwColor.color,
                  }}
                >
                  {dwPct}%
                </span>

                {/* instability dot */}
                <span
                  title={`Avg instability: ${Math.round(inst * 100)}%`}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: instColor,
                    flexShrink: 0,
                  }}
                />
              </div>
            );
          })
        )}
      </div>
    </AppLayout>
  );
}
