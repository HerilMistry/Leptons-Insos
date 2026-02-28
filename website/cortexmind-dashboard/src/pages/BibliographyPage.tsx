import { useState, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";

const references = [
  {
    id: 1,
    authors: "Miller, E.K. & Cohen, J.D.",
    year: 2001,
    title: "An integrative theory of prefrontal cortex function",
    journal: "Annual Review of Neuroscience",
    details: "24, 167–202",
    relevance: "Foundation for ECN modelling — prefrontal top-down control",
    network: "ECN",
    doi: "https://doi.org/10.1146/annurev.neuro.24.1.167",
  },
  {
    id: 2,
    authors: "Dosenbach, N.U. et al.",
    year: 2008,
    title: "A dual-networks architecture of top-down control",
    journal: "Trends in Cognitive Sciences",
    details: "12(3), 99–105",
    relevance: "Dual-network model underlying stable vs. flexible task control",
    network: "ECN",
    doi: "https://doi.org/10.1016/j.tics.2008.01.001",
  },
  {
    id: 3,
    authors: "Menon, V. & Uddin, L.Q.",
    year: 2010,
    title: "Saliency, switching, attention and control",
    journal: "Brain Structure and Function",
    details: "214, 655–667",
    relevance: "Basis for Salience Network switching model and instability proxy",
    network: "SN",
    doi: "https://doi.org/10.1007/s00429-010-0262-0",
  },
  {
    id: 4,
    authors: "Botvinick, M.M. et al.",
    year: 2001,
    title: "Conflict monitoring and cognitive control",
    journal: "Psychological Review",
    details: "108(3), 624–652",
    relevance: "ACC conflict detection — neural substrate of impulsive distraction",
    network: "SN",
    doi: "https://doi.org/10.1037/0033-295X.108.3.624",
  },
  {
    id: 5,
    authors: "Mason, M.F. et al.",
    year: 2007,
    title: "Wandering minds: the default network and stimulus-independent thought",
    journal: "Science",
    details: "315(5810), 393–395",
    relevance: "DMN activation during mind-wandering — basis for drift variable",
    network: "DMN",
    doi: "https://doi.org/10.1126/science.1131295",
  },
  {
    id: 6,
    authors: "Christoff, K. et al.",
    year: 2009,
    title: "Experience sampling during fMRI reveals default network and executive system contributions to mind wandering",
    journal: "PNAS",
    details: "106(21), 8719–8724",
    relevance: "fMRI evidence that DMN intrusions coincide with task-unrelated thought",
    network: "DMN",
    doi: "https://doi.org/10.1073/pnas.0900234106",
  },
  {
    id: 7,
    authors: "Mackworth, N.H.",
    year: 1948,
    title: "The breakdown of vigilance during prolonged visual search",
    journal: "British Journal of Psychology",
    details: "38(4), 1–24",
    relevance: "Vigilance decrement — scientific basis for fatigue accumulation model",
    network: "FATIGUE",
    doi: "https://doi.org/10.1111/j.2044-8295.1948.tb01140.x",
  },
  {
    id: 8,
    authors: "Mark, G. et al.",
    year: 2008,
    title: "The cost of interrupted work: more speed and stress",
    journal: "CHI Conference Proceedings",
    details: "107–110",
    relevance: "18-minute re-entry cost — basis for our interruption cost model",
    network: "SWITCHING",
    doi: "https://doi.org/10.1145/1357054.1357072",
  },
];

const networkColors: Record<string, { color: string; bg: string; border: string }> = {
  ECN:       { color: "#6366f1", bg: "rgba(99,102,241,0.1)",  border: "rgba(99,102,241,0.25)" },
  SN:        { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.25)" },
  DMN:       { color: "#8b5cf6", bg: "rgba(139,92,246,0.1)",  border: "rgba(139,92,246,0.25)" },
  FATIGUE:   { color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)" },
  SWITCHING: { color: "#22c55e", bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.25)" },
};

const filters = [
  { key: "ALL",   label: "All" },
  { key: "ECN",   label: "ECN" },
  { key: "DMN",   label: "DMN" },
  { key: "SN",    label: "SN" },
  { key: "OTHER", label: "Fatigue & Other" },
] as const;

type FilterKey = (typeof filters)[number]["key"];

export default function BibliographyPage() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("ALL");
  const [animKey, setAnimKey] = useState(0);

  const filtered = useMemo(() => {
    if (activeFilter === "ALL") return references;
    if (activeFilter === "OTHER")
      return references.filter((r) => r.network === "FATIGUE" || r.network === "SWITCHING");
    return references.filter((r) => r.network === activeFilter);
  }, [activeFilter]);

  const handleFilter = (key: FilterKey) => {
    setActiveFilter(key);
    setAnimKey((k) => k + 1);
  };

  const uniqueJournals = new Set(references.map((r) => r.journal)).size;
  const years = references.map((r) => r.year);
  const ecnCount = references.filter((r) => r.network === "ECN").length;
  const snCount = references.filter((r) => r.network === "SN").length;
  const dmnCount = references.filter((r) => r.network === "DMN").length;
  const otherCount = references.filter(
    (r) => r.network === "FATIGUE" || r.network === "SWITCHING"
  ).length;

  return (
    <AppLayout>
      <style>{`
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ref-card {
          animation: cardIn 0.35s ease both;
        }
      `}</style>

      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <h1 className="text-2xl font-bold text-white tracking-tight">Bibliography</h1>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginTop: 4 }}>
          Neuroscience foundations underlying CortexFlow's computational model
        </p>
        <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.08)", margin: "16px 0 12px" }} />
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, lineHeight: 1.6, maxWidth: 640 }}>
          Every variable, proxy, and dynamic rule in CortexFlow is derived from a validated neural
          mechanism. The following papers are not decorative citations — they are the structural
          basis of the state model.
        </p>

        {/* Filter row */}
        <div style={{ display: "flex", gap: 8, marginTop: 24, marginBottom: 20, flexWrap: "wrap" }}>
          {filters.map((f) => {
            const isActive = activeFilter === f.key;
            const nc =
              f.key === "ECN" ? networkColors.ECN
              : f.key === "DMN" ? networkColors.DMN
              : f.key === "SN" ? networkColors.SN
              : f.key === "OTHER" ? networkColors.FATIGUE
              : null;

            return (
              <button
                key={f.key}
                onClick={() => handleFilter(f.key)}
                style={{
                  padding: "5px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  border: "1px solid",
                  transition: "all 0.2s",
                  ...(isActive
                    ? {
                        background: nc ? nc.bg : "rgba(255,255,255,0.1)",
                        color: nc ? nc.color : "#fff",
                        borderColor: nc ? nc.border : "rgba(255,255,255,0.2)",
                      }
                    : {
                        background: "rgba(255,255,255,0.03)",
                        color: "rgba(255,255,255,0.35)",
                        borderColor: "rgba(255,255,255,0.06)",
                      }),
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Reference cards */}
        <div key={animKey}>
          {filtered.map((ref, index) => {
            const nc = networkColors[ref.network] ?? networkColors.SWITCHING;
            return (
              <div
                key={ref.id}
                className="ref-card"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderLeft: `3px solid ${nc.color}`,
                  borderRadius: 12,
                  padding: "18px 20px",
                  marginBottom: 10,
                  transition: "border-color 0.2s, background 0.2s",
                  animationDelay: `${index * 60}ms`,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)";
                }}
              >
                {/* Top row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>[{ref.id}]</span>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{ref.authors}</span>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 8px",
                        borderRadius: 99,
                        background: nc.bg,
                        color: nc.color,
                        fontWeight: 600,
                      }}
                    >
                      {ref.year}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 10px",
                      borderRadius: 99,
                      background: nc.bg,
                      color: nc.color,
                      fontWeight: 600,
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                      flexShrink: 0,
                    }}
                  >
                    {ref.network}
                  </span>
                </div>

                {/* Title */}
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: "#fff",
                    margin: "8px 0 4px 0",
                    lineHeight: 1.4,
                  }}
                >
                  {ref.title}
                </div>

                {/* Bottom row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-end",
                    marginTop: 6,
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>
                      {ref.journal}
                    </span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginLeft: 6 }}>
                      {ref.details}
                    </span>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,0.25)",
                        letterSpacing: 0.5,
                        marginBottom: 2,
                      }}
                    >
                      Relevance in CortexFlow:
                    </div>
                    <div style={{ fontSize: 11, color: nc.color, maxWidth: 300 }}>{ref.relevance}</div>
                  </div>
                </div>

                {/* DOI link */}
                {ref.doi && (
                  <a
                    href={ref.doi}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-block",
                      marginTop: 10,
                      fontSize: 11,
                      color: nc.color,
                      textDecoration: "none",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.textDecoration = "none";
                    }}
                  >
                    View Paper →
                  </a>
                )}
              </div>
            );
          })}
        </div>

        {/* Stats footer */}
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.2)",
            textAlign: "center",
            paddingTop: 24,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            marginTop: 16,
          }}
        >
          {references.length} papers &nbsp;·&nbsp; {uniqueJournals} journals &nbsp;·&nbsp;{" "}
          {Math.min(...years)}–{Math.max(...years)} &nbsp;·&nbsp; ECN ({ecnCount}) &nbsp;·&nbsp; SN (
          {snCount}) &nbsp;·&nbsp; DMN ({dmnCount}) &nbsp;·&nbsp; Other ({otherCount})
        </div>
      </div>
    </AppLayout>
  );
}
