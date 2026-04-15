import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ── Palette & design tokens ──────────────────────────────────────────────────
const COLORS = {
  bg: "#0B1120",
  surface: "#111827",
  surfaceHigh: "#1a2540",
  border: "#1e3a5f",
  accent: "#2563eb",
  accentLight: "#3b82f6",
  accentGlow: "rgba(37,99,235,0.25)",
  danger: "#ef4444",
  warning: "#f59e0b",
  success: "#10b981",
  text: "#e2e8f0",
  textMuted: "#64748b",
  textDim: "#94a3b8",
  pin: {
    high: "#ef4444",
    medium: "#f59e0b",
    low: "#10b981",
  },
};

// ── Licab municipality center (Nueva Ecija, PH) ──────────────────────────────
const LICAB_CENTER = { lat: 15.6394, lng: 120.8064 };
const LICAB_BOUNDS = {
  minLat: 15.59,
  maxLat: 15.69,
  minLng: 120.76,
  maxLng: 120.85,
};

// ── Scoring definitions ──────────────────────────────────────────────────────
const INFRA_TYPES = ["Road", "Bridge", "Public Building"];

const CHECKLIST = {
  Road: [
    { id: "r1", label: "Large cracks (> 5 cm wide)", weight: 3 },
    { id: "r2", label: "Small cracks (≤ 5 cm wide)", weight: 1 },
    { id: "r3", label: "Potholes present", weight: 2 },
    { id: "r4", label: "Surface completely broken / missing", weight: 4 },
    { id: "r5", label: "Subsidence / road sinking", weight: 3 },
    { id: "r6", label: "Flooding / drainage failure", weight: 2 },
    { id: "r7", label: "Guardrail damaged or missing", weight: 2 },
  ],
  Bridge: [
    { id: "b1", label: "Visible structural cracks on deck", weight: 3 },
    { id: "b2", label: "Corroded / missing rebar exposed", weight: 4 },
    { id: "b3", label: "Bridge railings damaged", weight: 2 },
    { id: "b4", label: "Deck surface deteriorating", weight: 2 },
    { id: "b5", label: "Foundation / abutment damage", weight: 4 },
    { id: "b6", label: "Partial collapse or displacement", weight: 5 },
    { id: "b7", label: "Load-bearing capacity visibly compromised", weight: 4 },
  ],
  "Public Building": [
    { id: "p1", label: "Wall cracks (minor hairline)", weight: 1 },
    { id: "p2", label: "Wall cracks (structural / deep)", weight: 3 },
    { id: "p3", label: "Roof damage / leakage", weight: 3 },
    { id: "p4", label: "Broken windows / doors", weight: 1 },
    { id: "p5", label: "Flooring or stair damage", weight: 2 },
    { id: "p6", label: "Electrical / utility hazard visible", weight: 4 },
    { id: "p7", label: "Partial structural collapse", weight: 5 },
  ],
};

const getSeverity = (score) => {
  if (score >= 9) return "High";
  if (score >= 4) return "Medium";
  return "Low";
};

const severityColor = (s) =>
  s === "High" ? COLORS.pin.high : s === "Medium" ? COLORS.pin.medium : COLORS.pin.low;

// ── Mock approved reports ────────────────────────────────────────────────────
const MOCK_REPORTS = [
  {
    id: 1,
    lat: 15.642,
    lng: 120.81,
    type: "Road",
    severity: "High",
    score: 12,
    desc: "Large potholes and complete surface failure along the main highway.",
    date: "2025-04-10",
    photo: null,
  },
  {
    id: 2,
    lat: 15.635,
    lng: 120.798,
    type: "Bridge",
    severity: "Medium",
    score: 6,
    desc: "Visible deck cracks and corroding railings on the barangay bridge.",
    date: "2025-04-08",
    photo: null,
  },
  {
    id: 3,
    lat: 15.642,
    lng: 120.81,
    type: "Public Building",
    severity: "Low",
    score: 2,
    desc: "Hairline wall cracks in the covered court.",
    date: "2025-04-07",
    photo: null,
  },
  {
    id: 4,
    lat: 15.628,
    lng: 120.815,
    type: "Road",
    severity: "Medium",
    score: 5,
    desc: "Multiple potholes and drainage problems near the market area.",
    date: "2025-04-05",
    photo: null,
  },
  {
    id: 5,
    lat: 15.652,
    lng: 120.802,
    type: "Bridge",
    severity: "High",
    score: 13,
    desc: "Foundation displacement and exposed rebar on bridge near north sitio.",
    date: "2025-04-03",
    photo: null,
  },
];

// ── Create a custom Leaflet divIcon for each severity ──────────────────────
const createPinIcon = (severity, count = 1) => {
  const color = severityColor(severity);
  const badge =
    count > 1
      ? `<div style="
          position:absolute;top:-6px;right:-6px;
          background:#1e293b;border:1.5px solid ${color};
          color:white;font-size:9px;font-weight:700;
          border-radius:50%;width:16px;height:16px;
          display:flex;align-items:center;justify-content:center;line-height:1;">
          ${count}
        </div>`
      : "";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="-14 -18 28 36">
      <circle r="14" fill="${color}" opacity="0.25"/>
      <path d="M0,-18 C8,-18 14,-12 14,-5 C14,5 0,18 0,18 C0,18 -14,5 -14,-5 C-14,-12 -8,-18 0,-18 Z"
            fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="0" cy="-5" r="5" fill="white" opacity="0.85"/>
    </svg>`;
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;display:inline-block;">${svg}${badge}</div>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
  });
};

// ── Group overlapping reports (same lat/lng cluster) ────────────────────────
const groupReports = (reports) => {
  const groups = [];
  reports.forEach((r) => {
    const existing = groups.find(
      (g) => Math.abs(g.lat - r.lat) < 0.003 && Math.abs(g.lng - r.lng) < 0.003
    );
    if (existing) {
      existing.reports.push(r);
      if (getSeverity(r.score) === "High") existing.topSeverity = "High";
      else if (getSeverity(r.score) === "Medium" && existing.topSeverity !== "High")
        existing.topSeverity = "Medium";
    } else {
      groups.push({ lat: r.lat, lng: r.lng, topSeverity: getSeverity(r.score), reports: [r] });
    }
  });
  return groups;
};

// ════════════════════════════════════════════════════════════════════════════
// COMPONENT: Report Panel
// ════════════════════════════════════════════════════════════════════════════
function ReportPanel({ group, onClose }) {
  const sorted = [...group.reports].sort((a, b) => b.score - a.score);
  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: 1, color: COLORS.textDim }}>
          REPORTS AT LOCATION
        </span>
        <button onClick={onClose} style={styles.closeBtn}>✕</button>
      </div>
      <div style={{ overflowY: "auto", maxHeight: 400 }}>
        {sorted.map((r, i) => (
          <div
            key={r.id}
            style={{ ...styles.reportCard, borderLeft: `3px solid ${severityColor(getSeverity(r.score))}` }}
          >
            <div style={styles.reportCardTop}>
              <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.textDim, letterSpacing: 1 }}>
                #{i + 1} · {r.type.toUpperCase()}
              </span>
              <span
                style={{
                  ...styles.badge,
                  background: severityColor(getSeverity(r.score)) + "22",
                  color: severityColor(getSeverity(r.score)),
                  border: `1px solid ${severityColor(getSeverity(r.score))}55`,
                }}
              >
                {getSeverity(r.score)} · Score {r.score}
              </span>
            </div>
            <p style={{ margin: "6px 0 4px", fontSize: 13, color: COLORS.text, lineHeight: 1.5 }}>
              {r.desc}
            </p>
            <span style={{ fontSize: 11, color: COLORS.textMuted }}>{r.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// COMPONENT: Submit Form
// ════════════════════════════════════════════════════════════════════════════
function SubmitForm({ pin, onClose, onSubmitted }) {
  const [type, setType] = useState("");
  const [checks, setChecks] = useState({});
  const [desc, setDesc] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef();

  const items = type ? CHECKLIST[type] : [];
  const score = items.reduce((s, i) => s + (checks[i.id] ? i.weight : 0), 0);
  const severity = type && score > 0 ? getSeverity(score) : null;

  const toggle = (id) => setChecks((p) => ({ ...p, [id]: !p[id] }));

  const handleSubmit = () => {
    if (!type || !desc.trim()) return;
    setSubmitted(true);
    setTimeout(() => {
      onSubmitted();
    }, 2200);
  };

  if (submitted) {
    return (
      <div style={styles.formWrap}>
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h3 style={{ color: COLORS.success, margin: "0 0 8px", fontSize: 18 }}>Report Submitted!</h3>
          <p style={{ color: COLORS.textMuted, fontSize: 13 }}>
            Your report is pending admin verification. It will appear on the map once approved.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.formWrap}>
      <div style={styles.panelHeader}>
        <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: 1, color: COLORS.textDim }}>
          NEW REPORT
        </span>
        <button onClick={onClose} style={styles.closeBtn}>✕</button>
      </div>

      <div style={{ overflowY: "auto", maxHeight: 480, paddingRight: 4 }}>
        {/* Location */}
        <div style={styles.formGroup}>
          <label style={styles.label}>📍 Pinned Location</label>
          <div style={{ ...styles.input, color: COLORS.textMuted, fontSize: 12 }}>
            {pin.lat.toFixed(5)}° N, {pin.lng.toFixed(5)}° E
          </div>
        </div>

        {/* Type */}
        <div style={styles.formGroup}>
          <label style={styles.label}>Infrastructure Type</label>
          <div style={{ display: "flex", gap: 8 }}>
            {INFRA_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => { setType(t); setChecks({}); }}
                style={{
                  ...styles.typeBtn,
                  background: type === t ? COLORS.accent : COLORS.surfaceHigh,
                  border: `1px solid ${type === t ? COLORS.accentLight : COLORS.border}`,
                  color: type === t ? "white" : COLORS.textDim,
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Checklist */}
        {type && (
          <div style={styles.formGroup}>
            <label style={styles.label}>Damage Checklist</label>
            <div style={styles.checkGrid}>
              {items.map((item) => (
                <label key={item.id} style={styles.checkItem}>
                  <input
                    type="checkbox"
                    checked={!!checks[item.id]}
                    onChange={() => toggle(item.id)}
                    style={{ accentColor: COLORS.accent, marginRight: 8 }}
                  />
                  <span style={{ fontSize: 13, color: COLORS.textDim, flex: 1 }}>{item.label}</span>
                  <span style={{ fontSize: 11, color: COLORS.textMuted }}>+{item.weight}</span>
                </label>
              ))}
            </div>
            {score > 0 && (
              <div style={styles.severityBar}>
                <span style={{ fontSize: 12, color: COLORS.textMuted }}>Score: {score}</span>
                <span
                  style={{
                    ...styles.badge,
                    background: severityColor(severity) + "22",
                    color: severityColor(severity),
                    border: `1px solid ${severityColor(severity)}55`,
                    marginLeft: "auto",
                  }}
                >
                  {severity} Severity
                </span>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        <div style={styles.formGroup}>
          <label style={styles.label}>Description</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Describe the damage in detail..."
            style={{ ...styles.input, height: 88, resize: "vertical", fontFamily: "inherit" }}
          />
        </div>

        {/* Photo */}
        <div style={styles.formGroup}>
          <label style={styles.label}>Photo (optional)</label>
          <div onClick={() => fileRef.current.click()} style={styles.dropzone}>
            {photoName ? (
              <span style={{ color: COLORS.accentLight, fontSize: 13 }}>📷 {photoName}</span>
            ) : (
              <span style={{ color: COLORS.textMuted, fontSize: 13 }}>Click to attach a photo</span>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => setPhotoName(e.target.files[0]?.name || "")}
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!type || !desc.trim()}
          style={{
            ...styles.submitBtn,
            opacity: !type || !desc.trim() ? 0.45 : 1,
            cursor: !type || !desc.trim() ? "not-allowed" : "pointer",
          }}
        >
          Submit Report
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// COMPONENT: Leaflet Map
// ════════════════════════════════════════════════════════════════════════════
function LeafletMap({ reports, pinMode, onMapClick, onPinClick, newPin, selectedGroup }) {
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markersRef = useRef([]);
  const newPinMarkerRef = useRef(null);
  const clickHandlerRef = useRef(null);

  // Initialize map
  useEffect(() => {
    if (leafletMapRef.current) return;

    const map = L.map(mapRef.current, {
      center: [LICAB_CENTER.lat, LICAB_CENTER.lng],
      zoom: 13,
      zoomControl: true,
    });

    // OpenStreetMap tile layer (free, no API key)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright" style="color:#64748b">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Dark overlay filter via CSS — applied directly on the tile layer pane
    const style = document.createElement("style");
    style.textContent = `
      .leaflet-tile-pane { filter: brightness(0.55) saturate(0.7) hue-rotate(190deg); }
      .leaflet-control-attribution { background: rgba(11,17,32,0.85) !important; color: #64748b !important; font-size: 10px !important; }
      .leaflet-control-attribution a { color: #64748b !important; }
      .leaflet-control-zoom a { background: #111827 !important; color: #94a3b8 !important; border-color: #1e3a5f !important; }
      .leaflet-control-zoom a:hover { background: #1a2540 !important; color: #e2e8f0 !important; }
    `;
    document.head.appendChild(style);

    leafletMapRef.current = map;
    return () => {
      map.remove();
      leafletMapRef.current = null;
    };
  }, []);

  // Update click handler when pinMode changes
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    if (clickHandlerRef.current) {
      map.off("click", clickHandlerRef.current);
    }

    const handler = (e) => {
      const { lat, lng } = e.latlng;
      if (
        lat < LICAB_BOUNDS.minLat || lat > LICAB_BOUNDS.maxLat ||
        lng < LICAB_BOUNDS.minLng || lng > LICAB_BOUNDS.maxLng
      ) {
        onMapClick({ outOfBounds: true });
        return;
      }
      onMapClick({ lat, lng });
    };

    map.on("click", handler);
    clickHandlerRef.current = handler;
    map.getContainer().style.cursor = pinMode ? "crosshair" : "";

    return () => {
      map.off("click", handler);
    };
  }, [pinMode, onMapClick]);

  // Render report markers
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const groups = groupReports(reports);
    groups.forEach((group) => {
      const isSelected =
        selectedGroup &&
        Math.abs(selectedGroup.lat - group.lat) < 0.001 &&
        Math.abs(selectedGroup.lng - group.lng) < 0.001;

      const marker = L.marker([group.lat, group.lng], {
        icon: createPinIcon(group.topSeverity, group.reports.length),
        zIndexOffset: isSelected ? 1000 : 0,
      }).addTo(map);

      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        onPinClick(group);
      });

      // Pulse ring for selected
      if (isSelected) {
        const pulseIcon = L.divIcon({
          className: "",
          html: `<div style="
            width:40px;height:40px;border-radius:50%;
            border:2px solid ${severityColor(group.topSeverity)};
            animation:leaflet-pulse 1.2s ease-out infinite;
            opacity:0.6;margin:-6px 0 0 -6px;
          "></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        const pulse = L.marker([group.lat, group.lng], { icon: pulseIcon, interactive: false }).addTo(map);
        markersRef.current.push(pulse);
      }

      markersRef.current.push(marker);
    });

    // Inject pulse animation once
    if (!document.getElementById("leaflet-pulse-style")) {
      const s = document.createElement("style");
      s.id = "leaflet-pulse-style";
      s.textContent = `
        @keyframes leaflet-pulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `;
      document.head.appendChild(s);
    }
  }, [reports, selectedGroup, onPinClick]);

  // New pin preview marker
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    if (newPinMarkerRef.current) {
      newPinMarkerRef.current.remove();
      newPinMarkerRef.current = null;
    }

    if (newPin) {
      const icon = L.divIcon({
        className: "",
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="-14 -18 28 36">
          <path d="M0,-18 C8,-18 14,-12 14,-5 C14,5 0,18 0,18 C0,18 -14,5 -14,-5 C-14,-12 -8,-18 0,-18 Z"
                fill="#60a5fa" stroke="white" stroke-width="1.5" opacity="0.85"/>
          <circle cx="0" cy="-5" r="5" fill="white" opacity="0.9"/>
        </svg>`,
        iconSize: [28, 36],
        iconAnchor: [14, 36],
      });
      newPinMarkerRef.current = L.marker([newPin.lat, newPin.lng], { icon, interactive: false }).addTo(map);
    }
  }, [newPin]);

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 520,
        background: "#0d1929",
      }}
    />
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [reports] = useState(MOCK_REPORTS);
  const [pinMode, setPinMode] = useState(false);
  const [newPin, setNewPin] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("All");
  const [toast, setToast] = useState("");

  const filteredReports =
    filter === "All" ? reports : reports.filter((r) => r.type === filter);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const handleMapClick = ({ lat, lng, outOfBounds }) => {
    if (!pinMode) return;
    if (outOfBounds) {
      showToast("⚠️ Please pin within the Licab municipality area.");
      return;
    }
    setNewPin({ lat, lng });
    setShowForm(true);
    setPinMode(false);
  };

  const handlePinClick = (group) => {
    if (pinMode) return;
    setSelectedGroup(group);
    setShowForm(false);
  };

  return (
    <div style={styles.root}>
      {/* ── Header ── */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}>
            <span style={styles.logoBadge}>LGU</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: 0.5, color: COLORS.text }}>
                Licab InfraWatch
              </div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, letterSpacing: 1 }}>
                NUEVA ECIJA · DAMAGE REPORTING SYSTEM
              </div>
            </div>
          </div>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.filterRow}>
            {["All", ...INFRA_TYPES].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  ...styles.filterBtn,
                  background: filter === f ? COLORS.accent : "transparent",
                  color: filter === f ? "white" : COLORS.textMuted,
                  border: `1px solid ${filter === f ? COLORS.accentLight : COLORS.border}`,
                }}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setPinMode((p) => !p);
              setSelectedGroup(null);
              setShowForm(false);
            }}
            style={{
              ...styles.reportBtn,
              background: pinMode ? COLORS.danger : COLORS.accent,
              boxShadow: pinMode
                ? `0 0 18px ${COLORS.danger}66`
                : `0 0 18px ${COLORS.accentGlow}`,
            }}
          >
            {pinMode ? "✕ Cancel" : "+ Report Damage"}
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={styles.body}>
        {/* Map */}
        <div
          style={{
            ...styles.mapWrap,
            cursor: pinMode ? "crosshair" : "default",
          }}
        >
          <LeafletMap
            reports={filteredReports}
            pinMode={pinMode}
            onMapClick={handleMapClick}
            onPinClick={handlePinClick}
            newPin={newPin}
            selectedGroup={selectedGroup}
          />

          {/* Pin mode banner */}
          {pinMode && (
            <div style={styles.pinBanner}>
              📍 Click on the map to pin the exact location of the damage
            </div>
          )}

          {/* Map attribution badge */}
          <div style={styles.mapBadge}>
            🗺️ OpenStreetMap
          </div>
        </div>

        {/* Side Panel */}
        {selectedGroup && !showForm && (
          <ReportPanel group={selectedGroup} onClose={() => setSelectedGroup(null)} />
        )}
        {showForm && newPin && (
          <SubmitForm
            pin={newPin}
            onClose={() => { setShowForm(false); setNewPin(null); }}
            onSubmitted={() => {
              setShowForm(false);
              setNewPin(null);
              showToast("✅ Report submitted for admin review!");
            }}
          />
        )}
      </div>

      {/* ── Legend ── */}
      <div style={styles.legend}>
        {["High", "Medium", "Low"].map((s) => (
          <div key={s} style={styles.legendItem}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: severityColor(s) }} />
            <span style={{ fontSize: 12, color: COLORS.textMuted }}>{s} Severity</span>
          </div>
        ))}
        <div style={{ width: 1, background: COLORS.border, margin: "0 8px" }} />
        <div style={styles.legendItem}>
          <span style={{ fontSize: 12, color: COLORS.textMuted }}>
            {reports.length} Approved Reports
          </span>
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  root: {
    minHeight: "100vh",
    background: COLORS.bg,
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    display: "flex",
    flexDirection: "column",
    color: COLORS.text,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 24px",
    background: COLORS.surface,
    borderBottom: `1px solid ${COLORS.border}`,
    gap: 12,
    flexWrap: "wrap",
    zIndex: 1000,
    position: "relative",
  },
  headerLeft: { display: "flex", alignItems: "center" },
  logo: { display: "flex", alignItems: "center", gap: 12 },
  logoBadge: {
    background: COLORS.accent,
    color: "white",
    fontWeight: 900,
    fontSize: 13,
    padding: "4px 8px",
    borderRadius: 6,
    letterSpacing: 1,
  },
  headerRight: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  filterRow: { display: "flex", gap: 6 },
  filterBtn: {
    padding: "5px 12px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    letterSpacing: 0.5,
    transition: "all 0.15s",
  },
  reportBtn: {
    padding: "8px 18px",
    borderRadius: 8,
    border: "none",
    color: "white",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    letterSpacing: 0.5,
    transition: "all 0.2s",
  },
  body: {
    flex: 1,
    display: "flex",
    gap: 0,
    overflow: "hidden",
    position: "relative",
  },
  mapWrap: {
    flex: 1,
    position: "relative",
    background: "#0d1929",
    minHeight: 520,
  },
  pinBanner: {
    position: "absolute",
    top: 16,
    left: "50%",
    transform: "translateX(-50%)",
    background: COLORS.accent,
    color: "white",
    padding: "8px 20px",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
    pointerEvents: "none",
    boxShadow: `0 4px 20px ${COLORS.accentGlow}`,
    whiteSpace: "nowrap",
    zIndex: 900,
  },
  mapBadge: {
    position: "absolute",
    bottom: 32,
    right: 10,
    background: "rgba(11,17,32,0.75)",
    color: COLORS.textMuted,
    fontSize: 10,
    padding: "3px 8px",
    borderRadius: 6,
    pointerEvents: "none",
    zIndex: 900,
    border: `1px solid ${COLORS.border}`,
  },
  panel: {
    width: 340,
    background: COLORS.surface,
    borderLeft: `1px solid ${COLORS.border}`,
    display: "flex",
    flexDirection: "column",
    animation: "slideIn 0.2s ease",
    zIndex: 800,
  },
  formWrap: {
    width: 340,
    background: COLORS.surface,
    borderLeft: `1px solid ${COLORS.border}`,
    display: "flex",
    flexDirection: "column",
    animation: "slideIn 0.2s ease",
    zIndex: 800,
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    borderBottom: `1px solid ${COLORS.border}`,
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: COLORS.textMuted,
    cursor: "pointer",
    fontSize: 14,
    padding: "2px 6px",
    borderRadius: 4,
  },
  reportCard: {
    padding: "12px 16px",
    borderBottom: `1px solid ${COLORS.border}`,
    marginLeft: 0,
    transition: "background 0.15s",
  },
  reportCardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  badge: {
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 20,
    letterSpacing: 0.5,
  },
  formGroup: { padding: "12px 16px 0" },
  label: {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
    color: COLORS.textMuted,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  input: {
    width: "100%",
    background: COLORS.surfaceHigh,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    color: COLORS.text,
    padding: "9px 12px",
    fontSize: 13,
    boxSizing: "border-box",
    outline: "none",
  },
  typeBtn: {
    flex: 1,
    padding: "7px 4px",
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    letterSpacing: 0.3,
    transition: "all 0.15s",
  },
  checkGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    background: COLORS.surfaceHigh,
    borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
    padding: 10,
  },
  checkItem: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    cursor: "pointer",
    padding: "3px 0",
  },
  severityBar: {
    display: "flex",
    alignItems: "center",
    marginTop: 8,
    padding: "6px 10px",
    background: COLORS.bg,
    borderRadius: 7,
  },
  dropzone: {
    border: `1.5px dashed ${COLORS.border}`,
    borderRadius: 8,
    padding: "16px",
    textAlign: "center",
    cursor: "pointer",
    transition: "border-color 0.15s",
    background: COLORS.surfaceHigh,
  },
  submitBtn: {
    margin: "16px",
    padding: "11px",
    borderRadius: 8,
    border: "none",
    background: COLORS.accent,
    color: "white",
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: 0.5,
    boxShadow: `0 4px 14px ${COLORS.accentGlow}`,
    transition: "all 0.2s",
    width: "calc(100% - 32px)",
  },
  legend: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "10px 24px",
    background: COLORS.surface,
    borderTop: `1px solid ${COLORS.border}`,
    flexWrap: "wrap",
    zIndex: 1000,
    position: "relative",
  },
  legendItem: { display: "flex", alignItems: "center", gap: 6 },
  toast: {
    position: "fixed",
    bottom: 60,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#1e293b",
    border: `1px solid ${COLORS.border}`,
    color: COLORS.text,
    padding: "10px 24px",
    borderRadius: 24,
    fontSize: 13,
    fontWeight: 600,
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
    zIndex: 9999,
    animation: "fadeIn 0.2s ease",
    whiteSpace: "nowrap",
  },
};