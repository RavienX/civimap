import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ── Supabase Client ─────────────────────────────────────────────────────────
const SUPABASE_URL = "https://afvhvhnzmrcykpqlmqnr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_b5qxLBFPNW64wwYfCuoalA_oAUo3Viu";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const GOOGLE_MAPS_API_KEY = "AIzaSyAd2kPUWd-cMhs2r4ScEFZDtHuvGQgSZbY";

// ── Palette — modern light civic theme ─────────────────────────────────
const COLORS = {
  bg: "#f0f4fa",
  surface: "#ffffff",
  surfaceHigh: "#f7f9fd",
  surfaceMid: "#e8eef8",
  border: "#dde5f0",
  accent: "#2563eb",
  accentLight: "#3b82f6",
  accentGlow: "rgba(37,99,235,0.18)",
  accentSoft: "#eff4ff",
  danger: "#dc2626",
  dangerSoft: "#fef2f2",
  warning: "#d97706",
  warningSoft: "#fffbeb",
  success: "#059669",
  successSoft: "#ecfdf5",
  text: "#0f172a",
  textMuted: "#64748b",
  textDim: "#334155",
  pin: { high: "#dc2626", medium: "#d97706", low: "#059669" },
};

const LICAB_CENTER = { lat: 15.6394, lng: 120.8064 };
// Tight bounds: barangays around Licab only, excludes clicking on the town center label area
const LICAB_BOUNDS = { minLat: 15.605, maxLat: 15.685, minLng: 120.768, maxLng: 120.848 };

// Map zoom — zoomed in so only Licab is visible
const LICAB_ZOOM = 14;

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
const severityIcon = (s) => (s === "High" ? "🔴" : s === "Medium" ? "🟡" : "🟢");
const typeIcon = (t) => (t === "Road" ? "🛣️" : t === "Bridge" ? "🌉" : "🏛️");

const groupReports = (reports) => {
  return reports.map((r) => ({
    lat: r.lat,
    lng: r.lng,
    topSeverity: getSeverity(r.score),
    reports: [r],
  }));
};

// Light map styles
const LIGHT_MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#f5f7fa" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f7fa" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7a8caa" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#3a5f8a" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#7a9bbf" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#d8edda" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#5a8a6a" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#dde3ec" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a9aaa" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e8eef7" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#c8d4e6" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#6a7a9a" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#e8eef7" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#8a9aaa" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c8dff5" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#5a7a9a" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#c8dff5" }] },
];

const loadGoogleMaps = (apiKey) => {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) { resolve(window.google.maps); return; }
    const existing = document.getElementById("google-maps-script");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google.maps));
      return;
    }
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });
};

// ════════════════════════════════════════════════════════════════════════════
// COMPONENT: Report Panel
// ════════════════════════════════════════════════════════════════════════════
function ReportPanel({ group, onClose, isMobile }) {
  const sorted = [...group.reports].sort((a, b) => b.score - a.score);
  return (
    <aside style={getPanelWrapStyle(isMobile)}>
      <div style={panelStyles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: severityColor(group.topSeverity), boxShadow: `0 0 10px ${severityColor(group.topSeverity)}99` }} />
          <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: 0.8, color: COLORS.text }}>
            {sorted.length} Report{sorted.length > 1 ? "s" : ""} at Location
          </span>
        </div>
        <button onClick={onClose} style={panelStyles.closeBtn} aria-label="Close">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M1 1L13 13M13 1L1 13" stroke={COLORS.textMuted} strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div style={{ overflowY: "auto", flex: 1, padding: "6px 0" }}>
        {sorted.map((r) => {
          const sev = getSeverity(r.score);
          return (
            <div key={r.id} style={{ ...panelStyles.card, borderLeft: `3px solid ${severityColor(sev)}` }}>
              <div style={panelStyles.cardTop}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 17 }}>{typeIcon(r.type)}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>{r.type}</span>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: "5px 13px", borderRadius: 20,
                  background: severityColor(sev) + "15",
                  color: severityColor(sev),
                  border: `1px solid ${severityColor(sev)}40`,
                  letterSpacing: 0.3,
                }}>
                  {severityIcon(sev)} {sev} · {r.score}pts
                </span>
              </div>

              {/* Place name */}
              {r.placeName && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, padding: "5px 10px", background: COLORS.accentSoft, borderRadius: 8, border: `1px solid ${COLORS.accent}20` }}>
                  <span style={{ fontSize: 12 }}>📍</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.accent }}>{r.placeName}</span>
                </div>
              )}

              <p style={{ margin: "8px 0 12px", fontSize: 14, color: COLORS.textDim, lineHeight: 1.7 }}>{r.desc}</p>

              {/* Damage Checklist */}
              {r.checks && r.checks.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.0, color: COLORS.textMuted, textTransform: "uppercase", marginBottom: 8 }}>
                    ✅ Damage Checklist
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {r.checks.map((label, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 12px", background: COLORS.successSoft, borderRadius: 9, border: `1px solid ${COLORS.success}25` }}>
                        <span style={{ fontSize: 13, color: COLORS.success, flexShrink: 0 }}>✓</span>
                        <span style={{ fontSize: 13, color: COLORS.textDim, fontWeight: 500 }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Photo */}
              {r.photo && (
                <div style={{ marginBottom: 8 }}>
                  <img
                    src={r.photo}
                    alt="Report photo"
                    style={{ width: "100%", borderRadius: 14, maxHeight: 220, objectFit: "cover", border: `1px solid ${COLORS.border}`, boxShadow: "0 4px 16px rgba(15,23,42,0.10)" }}
                  />
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4, paddingTop: 12, borderTop: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: 12, color: COLORS.textMuted, fontWeight: 500 }}>📅 {r.date}</span>
                {r.respondent && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13 }}>👤</span>
                    <span style={{ fontSize: 12, color: COLORS.textMuted }}>
                      Reported by:{" "}
                      <strong style={{ color: COLORS.textDim, fontWeight: 700 }}>{r.respondent}</strong>
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// COMPONENT: Submit Form
// ════════════════════════════════════════════════════════════════════════════
function SubmitForm({ pin, onClose, onSubmitted, isMobile }) {
  const [type, setType] = useState("");
  const [checks, setChecks] = useState({});
  const [desc, setDesc] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [respondentName, setRespondentName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationLoading, setLocationLoading] = useState(true);
  const [activePin, setActivePin] = useState(pin);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const fileRef = useRef();

  const reverseGeocode = useCallback(async (lat, lng, onDone) => {
    const fallback = `${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E`;

    try {
      // Step 1: New Places API (CORS-friendly) — nearest named POI
      const placesRes = await fetch(
        `https://places.googleapis.com/v1/places:searchNearby`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
            "X-Goog-FieldMask": "places.displayName,places.shortFormattedAddress",
          },
          body: JSON.stringify({
            locationRestriction: {
              circle: { center: { latitude: lat, longitude: lng }, radius: 200 },
            },
            rankPreference: "DISTANCE",
            maxResultCount: 1,
          }),
        }
      );
      const placesData = await placesRes.json();
      if (placesData.places?.length > 0) {
        const top = placesData.places[0];
        const name = top.displayName?.text || "";
        const addr = top.shortFormattedAddress || "";
        const area = addr ? addr.split(",")[0].trim() : "";
        if (name) {
          setLocationName(area ? `Near ${name}, ${area}` : `Near ${name}`);
          onDone && onDone();
          return;
        }
      }
    } catch { /* fall through */ }

    try {
      // Step 2: Geocoding REST API fallback
      const geoRes = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}&language=en`
      );
      const geoData = await geoRes.json();
      if (geoData.status === "OK" && geoData.results?.length > 0) {
        const result =
          geoData.results.find((r) =>
            r.types?.some((t) =>
              ["establishment", "point_of_interest", "premise", "school"].includes(t)
            )
          ) || geoData.results[0];
        const comps = result.address_components || [];
        const premise = comps.find((c) => c.types.includes("premise"))?.long_name || "";
        const route = comps.find((c) => c.types.includes("route"))?.long_name || "";
        const sublocal =
          comps.find(
            (c) => c.types.includes("sublocality_level_1") || c.types.includes("sublocality")
          )?.long_name || "";
        const locality = comps.find((c) => c.types.includes("locality"))?.long_name || "";
        const label = premise
          ? `${premise}, ${sublocal || locality}`
          : route
            ? `${route}, ${sublocal || locality}`
            : result.formatted_address?.split(",").slice(0, 2).join(",").trim() || fallback;
        setLocationName(label);
        onDone && onDone();
        return;
      }
    } catch { /* fall through */ }

    setLocationName(fallback);
    onDone && onDone();
  }, []);

  useEffect(() => {
    if (!activePin) { setLocationLoading(false); return; }
    reverseGeocode(activePin.lat, activePin.lng, () => setLocationLoading(false));
  }, []);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }
    setGeoLoading(true);
    setGeoError("");
    setLocationLoading(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setActivePin({ lat, lng });
        setLocationLoading(true);
        reverseGeocode(lat, lng, () => { setLocationLoading(false); setGeoLoading(false); });
      },
      () => {
        setGeoLoading(false);
        setGeoError("Could not get your location. Please allow location access.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const items = type ? CHECKLIST[type] : [];
  const score = items.reduce((s, i) => s + (checks[i.id] ? i.weight : 0), 0);
  const severity = type && score > 0 ? getSeverity(score) : null;
  const toggle = (id) => setChecks((p) => ({ ...p, [id]: !p[id] }));

  const handleSubmit = async () => {
    if (!type || !desc.trim()) return;
    setSubmitting(true);
    setSubmitError("");

    try {
      let photo_url = null;

      const file = fileRef.current?.files?.[0];
      if (file) {
        const ext = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("report-photos")
          .upload(fileName, file, { contentType: file.type });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("report-photos")
          .getPublicUrl(fileName);

        photo_url = urlData.publicUrl;
      }

      const checkedLabels = items
        .filter((item) => checks[item.id])
        .map((item) => item.label);

      const { error: insertError } = await supabase.from("reports").insert({
        lat: activePin.lat,
        lng: activePin.lng,
        type,
        score,
        severity: severity || "Low",
        place_name: locationName || null,
        description: desc,
        respondent: respondentName || null,
        checks: checkedLabels,
        photo_url,
      });

      if (insertError) throw insertError;

      setSubmitted(true);
      setTimeout(() => onSubmitted(), 2200);
    } catch (err) {
      console.error("Submit failed:", err.message);
      setSubmitError("Submission failed. Please try again.");
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <aside style={getPanelWrapStyle(isMobile)}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: "40px 24px", textAlign: "center" }}>
          <div style={{ width: 68, height: 68, borderRadius: "50%", background: COLORS.success + "18", border: `2px solid ${COLORS.success}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 16 }}>✅</div>
          <h3 style={{ color: COLORS.success, margin: "0 0 10px", fontSize: 18, fontWeight: 800 }}>Report Submitted!</h3>
          <p style={{ color: COLORS.textMuted, fontSize: 13, lineHeight: 1.7, maxWidth: 260 }}>
            Your report is pending admin verification. It will appear on the map once approved.
          </p>
        </div>
      </aside>
    );
  }

  const canSubmit = type && desc.trim() && !submitting;

  return (
    <aside style={getPanelWrapStyle(isMobile)}>
      <div style={panelStyles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>📍</span>
          <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: 0.5, color: COLORS.text }}>New Damage Report</span>
        </div>
        <button onClick={onClose} style={panelStyles.closeBtn} aria-label="Close">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M1 1L13 13M13 1L1 13" stroke={COLORS.textMuted} strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div style={{ overflowY: "auto", flex: 1 }}>
        {/* Location */}
        <div style={panelStyles.section}>
          <label style={panelStyles.label}>Pinned Location</label>
          <div style={{ ...panelStyles.infoBox }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ fontSize: 14, marginTop: 2 }}>📌</span>
              <div style={{ flex: 1 }}>
                {locationLoading ? (
                  <span style={{ color: COLORS.textMuted, fontStyle: "italic", fontSize: 13 }}>Resolving location name…</span>
                ) : locationName ? (
                  <span style={{ color: COLORS.text, fontWeight: 700, fontSize: 13, lineHeight: 1.45, display: "block", marginBottom: 3 }}>{locationName}</span>
                ) : null}
                <div style={{ color: COLORS.textMuted, fontSize: 11 }}>
                  {activePin.lat.toFixed(5)}° N, {activePin.lng.toFixed(5)}° E
                </div>
              </div>
            </div>
            <button
              onClick={handleGetCurrentLocation}
              disabled={geoLoading}
              style={{
                marginTop: 12, padding: "11px 16px", borderRadius: 12,
                border: `1.5px solid ${COLORS.accent}30`,
                background: geoLoading ? COLORS.surfaceMid : COLORS.accentSoft,
                color: geoLoading ? COLORS.textMuted : COLORS.accent,
                fontSize: 13, fontWeight: 700, cursor: geoLoading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 7, transition: "all 0.15s",
                width: "100%", justifyContent: "center",
              }}
            >
              {geoLoading
                ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> Finding your location…</>
                : <><span>🎯</span> Use My Current Location</>
              }
            </button>
            {geoError && <p style={{ margin: "6px 0 0", fontSize: 11, color: COLORS.danger }}>{geoError}</p>}
          </div>
        </div>

        {/* Respondent Name */}
        <div style={panelStyles.section}>
          <label style={panelStyles.label}>
            Respondent Name
            <span style={{ color: COLORS.textMuted, fontSize: 10, marginLeft: 6, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
          </label>
          <input
            type="text"
            value={respondentName}
            onChange={(e) => setRespondentName(e.target.value)}
            placeholder="Enter your full name…"
            style={{ ...panelStyles.input }}
          />
        </div>

        {/* Type */}
        <div style={panelStyles.section}>
          <label style={panelStyles.label}>Infrastructure Type <span style={{ color: COLORS.danger }}>*</span></label>
          <div style={{ display: "flex", gap: 6 }}>
            {INFRA_TYPES.map((t) => (
              <button key={t} onClick={() => { setType(t); setChecks({}); }}
                style={{
                  flex: 1, padding: "12px 6px", borderRadius: 14, fontSize: 12, fontWeight: 700,
                  cursor: "pointer", letterSpacing: 0.2, transition: "all 0.2s",
                  background: type === t ? COLORS.accent : COLORS.surface,
                  border: `2px solid ${type === t ? COLORS.accent : COLORS.border}`,
                  color: type === t ? "white" : COLORS.textDim,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  boxShadow: type === t ? `0 4px 16px ${COLORS.accentGlow}` : "0 1px 4px rgba(15,23,42,0.06)",
                }}>
                <span style={{ fontSize: 22 }}>{typeIcon(t)}</span>
                <span>{t}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Checklist */}
        {type && (
          <div style={panelStyles.section}>
            <label style={panelStyles.label}>Damage Checklist</label>
            <div style={{ background: COLORS.surfaceHigh, borderRadius: 10, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
              {items.map((item, idx) => (
                <label key={item.id} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
                  cursor: "pointer", background: checks[item.id] ? COLORS.accent + "0f" : "transparent",
                  borderBottom: idx < items.length - 1 ? `1px solid ${COLORS.border}` : "none",
                  transition: "background 0.15s",
                }}>
                  <input type="checkbox" checked={!!checks[item.id]} onChange={() => toggle(item.id)}
                    style={{ accentColor: COLORS.accent, width: 17, height: 17, flexShrink: 0, cursor: "pointer" }} />
                  <span style={{ fontSize: 13, color: checks[item.id] ? COLORS.text : COLORS.textDim, flex: 1, fontWeight: checks[item.id] ? 600 : 400 }}>{item.label}</span>
                  <span style={{ fontSize: 11, color: checks[item.id] ? COLORS.accent : COLORS.textMuted, fontWeight: 700, background: checks[item.id] ? COLORS.accentSoft : COLORS.border, padding: "2px 8px", borderRadius: 10, border: checks[item.id] ? `1px solid ${COLORS.accent}30` : "none" }}>+{item.weight}</span>
                </label>
              ))}
            </div>
            {score > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, padding: "12px 16px", background: severityColor(severity) + "0e", borderRadius: 12, border: `1px solid ${severityColor(severity)}30` }}>
                <span style={{ fontSize: 13, color: COLORS.textDim, fontWeight: 500 }}>Damage Score: <strong style={{ color: COLORS.text, fontSize: 15 }}>{score}</strong></span>
                <span style={{ fontSize: 12, fontWeight: 700, padding: "5px 14px", borderRadius: 20, background: severityColor(severity) + "18", color: severityColor(severity), border: `1px solid ${severityColor(severity)}44` }}>
                  {severityIcon(severity)} {severity} Severity
                </span>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        <div style={panelStyles.section}>
          <label style={panelStyles.label}>Description <span style={{ color: COLORS.danger }}>*</span></label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)}
            placeholder="Describe the damage in detail…"
            style={{ ...panelStyles.input, height: 100, resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }} />
        </div>

        {/* Photo */}
        <div style={panelStyles.section}>
          <label style={panelStyles.label}>Photo (optional)</label>
          <div onClick={() => fileRef.current.click()} style={{
            border: `2px dashed ${COLORS.border}`, borderRadius: 14, padding: "20px 16px",
            textAlign: "center", cursor: "pointer", background: COLORS.surfaceHigh,
            transition: "all 0.2s",
          }}>
            {photoName
              ? <span style={{ color: COLORS.accent, fontSize: 14, fontWeight: 700 }}>📷 {photoName}</span>
              : <><div style={{ fontSize: 30, marginBottom: 6 }}>📸</div><span style={{ color: COLORS.textMuted, fontSize: 13, fontWeight: 500 }}>Click to attach a photo</span></>
            }
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={(e) => setPhotoName(e.target.files[0]?.name || "")} />
          </div>
        </div>

        {submitError && (
          <div style={{ margin: "10px 24px 0", padding: "12px 16px", background: "#fef2f2", border: `1px solid ${COLORS.danger}30`, borderRadius: 12, fontSize: 13, color: COLORS.danger, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>⚠️</span> {submitError}
          </div>
        )}

        <div style={{ padding: isMobile ? "16px 24px 36px" : "16px 24px 24px", flexShrink: 0 }}>
          <button onClick={handleSubmit} disabled={!canSubmit}
            style={{
              width: "100%", padding: "16px", borderRadius: 14, border: "none",
              background: canSubmit ? `linear-gradient(135deg, ${COLORS.accent}, #1d4ed8)` : COLORS.surfaceMid,
              color: canSubmit ? "white" : COLORS.textMuted,
              fontWeight: 800, fontSize: 15, letterSpacing: 0.4,
              boxShadow: canSubmit ? `0 6px 24px ${COLORS.accentGlow}` : "none",
              transition: "all 0.2s", cursor: canSubmit ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
            }}>
            {submitting
              ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block", fontSize: 16 }}>⏳</span> Submitting…</>
              : canSubmit ? "🚀 Submit Report" : "Complete all required fields"
            }
          </button>
        </div>
      </div>
    </aside>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// COMPONENT: Google Map
// ════════════════════════════════════════════════════════════════════════════
function GoogleMap({ reports, pinMode, onMapClick, onPinClick, newPin, selectedGroup }) {
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const markersRef = useRef([]);
  const newPinMarkerRef = useRef(null);
  const onMapClickRef = useRef(onMapClick);
  const pinModeRef = useRef(pinMode);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { pinModeRef.current = pinMode; }, [pinMode]);
  const onPinClickRef = useRef(onPinClick);
  useEffect(() => { onPinClickRef.current = onPinClick; }, [onPinClick]);

  useEffect(() => {
    loadGoogleMaps(GOOGLE_MAPS_API_KEY)
      .then(() => setMapsLoaded(true))
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    if (!mapsLoaded || googleMapRef.current || !mapRef.current) return;
    const { maps } = window.google;
    const map = new maps.Map(mapRef.current, {
      center: LICAB_CENTER,
      zoom: LICAB_ZOOM,
      minZoom: LICAB_ZOOM,
      styles: LIGHT_MAP_STYLES,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      gestureHandling: "greedy",
      zoomControlOptions: { position: maps.ControlPosition.RIGHT_BOTTOM },
      fullscreenControlOptions: { position: maps.ControlPosition.RIGHT_TOP },
      restriction: {
        latLngBounds: {
          north: LICAB_BOUNDS.maxLat,
          south: LICAB_BOUNDS.minLat,
          east: LICAB_BOUNDS.maxLng,
          west: LICAB_BOUNDS.minLng,
        },
        strictBounds: true,
      },
    });

    map.addListener("click", (e) => {
      if (!pinModeRef.current) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      // Block outside Licab bounds
      if (lat < LICAB_BOUNDS.minLat || lat > LICAB_BOUNDS.maxLat ||
        lng < LICAB_BOUNDS.minLng || lng > LICAB_BOUNDS.maxLng) {
        onMapClickRef.current({ outOfBounds: true });
        return;
      }
      onMapClickRef.current({ lat, lng });
    });

    googleMapRef.current = map;
  }, [mapsLoaded]);

  useEffect(() => {
    if (!googleMapRef.current) return;
    googleMapRef.current.setOptions({ draggableCursor: pinMode ? "crosshair" : "" });
  }, [pinMode]);

  useEffect(() => {
    if (!mapsLoaded || !googleMapRef.current) return;
    const { maps } = window.google;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const groups = groupReports(reports);
    groups.forEach((group) => {
      const sev = group.topSeverity;
      const color = severityColor(sev);
      const isSelected = selectedGroup &&
        Math.abs(selectedGroup.lat - group.lat) < 0.001 &&
        Math.abs(selectedGroup.lng - group.lng) < 0.001;
      const count = group.reports.length;

      const markerSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="-14 -18 28 36">
          <circle r="14" fill="${color}" opacity="0.15"/>
          <path d="M0,-18 C8,-18 14,-12 14,-5 C14,5 0,18 0,18 C0,18 -14,5 -14,-5 C-14,-12 -8,-18 0,-18 Z"
                fill="${color}" stroke="white" stroke-width="1.5"/>
          <circle cx="0" cy="-5" r="5" fill="white" opacity="0.95"/>
          ${isSelected ? `<circle cx="0" cy="-5" r="7" fill="none" stroke="white" stroke-width="1" opacity="0.5"/>` : ""}
        </svg>`;

      const marker = new maps.Marker({
        position: { lat: group.lat, lng: group.lng },
        map: googleMapRef.current,
        icon: {
          url: `data:image/svg+xml,${encodeURIComponent(markerSvg)}`,
          scaledSize: new maps.Size(28, 36),
          anchor: new maps.Point(14, 36),
        },
        zIndex: isSelected ? 1000 : 1,
        title: `${group.topSeverity} severity - ${count} report${count > 1 ? "s" : ""}`,
      });

      marker.addListener("click", () => {
        if (pinModeRef.current) return;
        onPinClickRef.current(group);
      });
      markersRef.current.push(marker);
    });

    if (!document.getElementById("gmaps-pulse-style")) {
      const s = document.createElement("style");
      s.id = "gmaps-pulse-style";
      s.textContent = `@keyframes gmaps-pulse { 0%{transform:scale(1);opacity:0.7} 100%{transform:scale(2.5);opacity:0} }`;
      document.head.appendChild(s);
    }
  }, [reports, selectedGroup, mapsLoaded]);

  useEffect(() => {
    if (!mapsLoaded || !googleMapRef.current) return;
    const { maps } = window.google;
    if (newPinMarkerRef.current) { newPinMarkerRef.current.setMap(null); newPinMarkerRef.current = null; }
    if (!newPin) return;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="-14 -18 28 36">
      <path d="M0,-18 C8,-18 14,-12 14,-5 C14,5 0,18 0,18 C0,18 -14,5 -14,-5 C-14,-12 -8,-18 0,-18 Z"
            fill="#2563eb" stroke="white" stroke-width="1.5" opacity="0.9"/>
      <circle cx="0" cy="-5" r="5" fill="white" opacity="0.95"/>
    </svg>`;
    newPinMarkerRef.current = new maps.Marker({
      position: { lat: newPin.lat, lng: newPin.lng },
      map: googleMapRef.current,
      icon: {
        url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
        scaledSize: new maps.Size(28, 36),
        anchor: new maps.Point(14, 36),
      },
    });
  }, [newPin, mapsLoaded]);

  if (loadError) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: COLORS.bg, gap: 12 }}>
        <span style={{ fontSize: 40 }}>🗺️</span>
        <p style={{ color: COLORS.textMuted, fontSize: 13, textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>
          Google Maps could not be loaded.<br />Please check your API key or network connection.
        </p>
      </div>
    );
  }

  return (
    <>
      <div ref={mapRef} style={{ width: "100%", height: "100%", minHeight: 400 }} />
      {!mapsLoaded && (
        <div style={{ position: "absolute", inset: 0, background: COLORS.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, zIndex: 10 }}>
          <div style={{ width: 32, height: 32, border: `3px solid ${COLORS.border}`, borderTopColor: COLORS.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <span style={{ color: COLORS.textMuted, fontSize: 13 }}>Loading Google Maps…</span>
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// COMPONENT: Stats Bar
// ════════════════════════════════════════════════════════════════════════════
function StatsBar({ reports }) {
  const high = reports.filter(r => getSeverity(r.score) === "High").length;
  const med = reports.filter(r => getSeverity(r.score) === "Medium").length;
  const low = reports.filter(r => getSeverity(r.score) === "Low").length;
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {[
        { label: "High", count: high, color: COLORS.pin.high },
        { label: "Med", count: med, color: COLORS.pin.medium },
        { label: "Low", count: low, color: COLORS.pin.low },
      ].map(({ label, count, color }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: color + "12", border: `1px solid ${color}30` }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, boxShadow: `0 0 5px ${color}` }} />
          <span style={{ fontSize: 12, color, fontWeight: 700 }}>{count} {label}</span>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  // ── Fetch approved reports from Supabase ──────────────────────────────────
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);

  useEffect(() => {
    async function fetchReports() {
      const { data, error } = await supabase
        .from("reports")
        .select("id, lat, lng, type, score, severity, place_name, description, photo_url, created_at, respondent, checks")
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching reports:", error);
        setReportsLoading(false);
        return;
      }

      setReports(
        (data || [])
          .filter((r) => r.lat != null && r.lng != null)
          .map((r) => ({
            id: r.id,
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lng),
            type: r.type,
            score: r.score,
            placeName: r.place_name,
            desc: r.description,
            photo: r.photo_url,
            date: r.created_at?.slice(0, 10),
            respondent: r.respondent,
            checks: Array.isArray(r.checks) ? r.checks : [],
          }))
      );
      setReportsLoading(false);
    }

    fetchReports();

    // ✅ Realtime — map updates instantly when admin approves
    const channel = supabase
      .channel("public-map-reports")
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, () => {
        fetchReports();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const [pinMode, setPinMode] = useState(false);
  const [newPin, setNewPin] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("All");
  const [toast, setToast] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showPanel, setShowPanel] = useState(true);
  const [pinGeoLoading, setPinGeoLoading] = useState(false);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  }, []);

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      showToast("⚠️ Geolocation is not supported by your browser.");
      return;
    }
    setPinGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (lat < LICAB_BOUNDS.minLat || lat > LICAB_BOUNDS.maxLat ||
          lng < LICAB_BOUNDS.minLng || lng > LICAB_BOUNDS.maxLng) {
          setPinGeoLoading(false);
          showToast("⚠️ Your location is outside the Licab municipality area.");
          return;
        }
        setNewPin({ lat, lng });
        setSelectedGroup(null);
        setShowForm(true);
        setPinMode(false);
        setShowPanel(true);
        setPinGeoLoading(false);
      },
      () => {
        setPinGeoLoading(false);
        showToast("⚠️ Could not get your location. Please allow location access.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [showToast]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const filteredReports = filter === "All" ? reports : reports.filter((r) => r.type === filter);

  const handleMapClick = useCallback(({ lat, lng, outOfBounds, centerBlocked }) => {
    if (!pinMode) return;
    if (outOfBounds) { showToast("⚠️ Please pin within the Licab municipality area."); return; }
    setNewPin({ lat, lng });
    setSelectedGroup(null);
    setShowForm(true);
    setPinMode(false);
    setShowPanel(true);
  }, [pinMode, showToast]);

  const handlePinClick = useCallback((group) => {
    if (pinMode) return;
    setSelectedGroup(group);
    setShowForm(false);
    setShowPanel(true);
  }, [pinMode]);

  const closePanel = () => { setSelectedGroup(null); setShowForm(false); setNewPin(null); setShowPanel(false); };

  const sideOpen = showPanel && (selectedGroup || showForm);

  return (
    <div style={{
      minHeight: "100vh", height: "100vh", width: "100vw",
      background: COLORS.bg,
      fontFamily: "'Plus Jakarta Sans', 'Segoe UI', system-ui, sans-serif",
      display: "flex", flexDirection: "column",
      color: COLORS.text, overflow: "hidden",
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    }}>
      {/* Global CSS */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; background: ${COLORS.bg} !important; }
        body { overflow: hidden !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideRight { from { transform: translateX(30px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: ${COLORS.textMuted}40; }
        button:focus-visible { outline: 2px solid ${COLORS.accentLight}; outline-offset: 2px; }
        input, textarea { box-sizing: border-box; font-family: inherit; }
        input:focus, textarea:focus { border-color: ${COLORS.accentLight} !important; box-shadow: 0 0 0 3px ${COLORS.accentGlow} !important; outline: none; }
        button { font-family: inherit; }
      `}</style>

      {/* ── Header ── */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: isMobile ? "0 16px" : "0 28px",
        height: isMobile ? "auto" : "68px",
        minHeight: isMobile ? 60 : 68,
        background: "#ffffff",
        borderBottom: `1px solid ${COLORS.border}`,
        gap: 12, flexWrap: isMobile ? "wrap" : "nowrap",
        zIndex: 1000, flexShrink: 0,
        paddingTop: isMobile ? 12 : 0,
        paddingBottom: isMobile ? 12 : 0,
        boxShadow: "0 2px 12px rgba(15,23,42,0.06)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
            color: "white", fontWeight: 900, fontSize: 13, padding: "7px 13px",
            borderRadius: 10, letterSpacing: 1.5,
            boxShadow: "0 2px 10px rgba(37,99,235,0.35)",
          }}>CIVI<span style={{ opacity: 0.75 }}>MAP</span></div>
          <div>
            <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 16, color: COLORS.text, lineHeight: 1.2, letterSpacing: -0.5 }}>CIVIMAP</div>
            {!isMobile && <div style={{ fontSize: 10, color: COLORS.textMuted, letterSpacing: 1.4, textTransform: "uppercase", marginTop: 2 }}>Licab · Damage Reporting</div>}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12, flexWrap: "wrap", flex: isMobile ? "1 1 100%" : "0 0 auto", justifyContent: isMobile ? "space-between" : "flex-end" }}>
          {!isMobile && <StatsBar reports={filteredReports} />}

          {/* Filters */}
          <div style={{ display: "flex", gap: 3, background: COLORS.surfaceHigh, borderRadius: 12, padding: 4, border: `1px solid ${COLORS.border}` }}>
            {["All", ...INFRA_TYPES].map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: isMobile ? "6px 11px" : "7px 14px",
                borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer",
                letterSpacing: 0.2, transition: "all 0.18s", border: "none",
                background: filter === f ? COLORS.accent : "transparent",
                color: filter === f ? "white" : COLORS.textMuted,
                boxShadow: filter === f ? `0 2px 8px ${COLORS.accentGlow}` : "none",
              }}>{f}</button>
            ))}
          </div>

          {/* Report button */}
          <button
            onClick={() => { setPinMode(p => !p); setSelectedGroup(null); setShowForm(false); }}
            style={{
              padding: isMobile ? "10px 18px" : "11px 24px",
              borderRadius: 12, border: "none", color: "white",
              fontWeight: 700, fontSize: isMobile ? 13 : 14, cursor: "pointer",
              letterSpacing: 0.3, transition: "all 0.2s", whiteSpace: "nowrap",
              background: pinMode ? "linear-gradient(135deg, #dc2626, #b91c1c)" : "linear-gradient(135deg, #3b82f6, #2563eb)",
              boxShadow: pinMode ? "0 4px 18px rgba(220,38,38,0.4)" : `0 4px 18px ${COLORS.accentGlow}`,
            }}>
            {pinMode ? "✕ Cancel" : (isMobile ? "＋ Report" : "＋ Report Damage")}
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        {/* Map */}
        <div style={{ flex: 1, position: "relative" }}>
          {reportsLoading && (
            <div style={{
              position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
              background: COLORS.surface, color: COLORS.text, padding: "10px 20px",
              borderRadius: 24, fontSize: 13, fontWeight: 600, zIndex: 900,
              display: "flex", alignItems: "center", gap: 8,
              boxShadow: "0 4px 20px rgba(15,23,42,0.14)",
              border: `1px solid ${COLORS.border}`,
            }}>
              <span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>⏳</span>
              Loading reports…
            </div>
          )}

          <GoogleMap
            reports={filteredReports}
            pinMode={pinMode}
            onMapClick={handleMapClick}
            onPinClick={handlePinClick}
            newPin={newPin}
            selectedGroup={selectedGroup}
          />

          {/* Pin mode banner */}
          {pinMode && (
            <div style={{
              position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
              background: COLORS.accent, color: "white", padding: "12px 20px 12px 24px",
              borderRadius: 28, fontSize: 13, fontWeight: 700, zIndex: 900,
              boxShadow: `0 8px 32px ${COLORS.accentGlow}`, whiteSpace: "nowrap",
              animation: "fadeUp 0.3s ease",
              display: "flex", alignItems: "center", gap: 10,
              border: "1px solid rgba(255,255,255,0.2)",
            }}>
              <span style={{ animation: "spin 2s linear infinite", display: "inline-block", fontSize: 16, pointerEvents: "none" }}>📍</span>
              <span style={{ pointerEvents: "none" }}>Click the map to pin the damage location</span>
              <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.15)", flexShrink: 0 }} />
              <button
                onClick={handleUseCurrentLocation}
                disabled={pinGeoLoading}
                style={{
                  background: pinGeoLoading ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.95)",
                  color: pinGeoLoading ? "rgba(255,255,255,0.6)" : COLORS.accent, border: "none", borderRadius: 16,
                  padding: "7px 16px", fontSize: 12, fontWeight: 700,
                  cursor: pinGeoLoading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                  letterSpacing: 0.3, whiteSpace: "nowrap",
                  transition: "all 0.15s",
                  flexShrink: 0,
                }}>
                {pinGeoLoading
                  ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span> Locating…</>
                  : <><span>📡</span> Use Current Location</>
                }
              </button>
            </div>
          )}

          {/* Mobile: Show panel toggle */}
          {isMobile && sideOpen && (
            <button onClick={() => setShowPanel(p => !p)} style={{
              position: "absolute", bottom: 22, left: "50%", transform: "translateX(-50%)",
              background: COLORS.accent, color: "white", border: "none",
              padding: "12px 28px", borderRadius: 24, fontSize: 13, fontWeight: 700,
              cursor: "pointer", zIndex: 900, boxShadow: `0 6px 20px ${COLORS.accentGlow}`,
              letterSpacing: 0.3,
            }}>
              {showPanel ? "⬇ Hide Details" : "⬆ Show Details"}
            </button>
          )}

          {/* Map badge */}
          <div style={{
            position: "absolute", bottom: 10, left: 12,
            background: "rgba(255,255,255,0.92)", color: COLORS.textMuted,
            fontSize: 10, padding: "5px 10px", borderRadius: 8,
            pointerEvents: "none", zIndex: 900, border: `1px solid ${COLORS.border}`,
            backdropFilter: "blur(8px)", fontWeight: 600,
            boxShadow: "0 2px 8px rgba(15,23,42,0.08)",
          }}>
            🗺️ Google Maps
          </div>
        </div>

        {/* Side Panel */}
        {sideOpen && (
          <div style={isMobile ? {
            position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 950,
            maxHeight: showPanel ? "72vh" : 0,
            overflow: "hidden",
            transition: "max-height 0.3s ease",
          } : {
            animation: "slideRight 0.22s ease",
            height: "100%",
          }}>
            {selectedGroup && !showForm && (
              <ReportPanel group={selectedGroup} onClose={closePanel} isMobile={isMobile} />
            )}
            {showForm && newPin && (
              <SubmitForm pin={newPin} onClose={closePanel} isMobile={isMobile}
                onSubmitted={() => { closePanel(); showToast("✅ Report submitted for admin review!"); }} />
            )}
          </div>
        )}
      </div>

      {/* ── Legend (desktop bottom bar) ── */}
      {!isMobile && (
        <div style={{
          display: "flex", alignItems: "center", gap: 16,
          padding: "10px 28px", background: COLORS.surface,
          borderTop: `1px solid ${COLORS.border}`,
          flexWrap: "wrap", flexShrink: 0,
          boxShadow: "0 -2px 12px rgba(15,23,42,0.04)",
        }}>
          <span style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase" }}>Legend</span>
          {["High", "Medium", "Low"].map((s) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: severityColor(s) + "10", border: `1px solid ${severityColor(s)}30` }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: severityColor(s), boxShadow: `0 0 5px ${severityColor(s)}88` }} />
              <span style={{ fontSize: 11, color: severityColor(s), fontWeight: 600 }}>{s}</span>
            </div>
          ))}
          <div style={{ width: 1, height: 14, background: COLORS.border }} />
          {INFRA_TYPES.map(t => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 13 }}>{typeIcon(t)}</span>
              <span style={{ fontSize: 11, color: COLORS.textDim, fontWeight: 500 }}>{t}</span>
            </div>
          ))}
          <div style={{ marginLeft: "auto", fontSize: 11, color: COLORS.textMuted }}>
            <span style={{ color: COLORS.accent, fontWeight: 700 }}>{reports.length}</span> approved reports · Licab, Nueva Ecija PH
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          background: COLORS.text, border: "none",
          color: "#ffffff", padding: "12px 28px", borderRadius: 28,
          fontSize: 13, fontWeight: 600, boxShadow: "0 8px 32px rgba(15,23,42,0.25)",
          zIndex: 9999, animation: "fadeUp 0.25s ease", whiteSpace: "nowrap",
          letterSpacing: 0.2,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Panel Styles ─────────────────────────────────────────────────────────────
const getPanelWrapStyle = (isMobile) => ({
  position: isMobile ? "fixed" : "absolute",
  bottom: isMobile ? 0 : "auto",
  right: isMobile ? 0 : 0,
  top: isMobile ? "auto" : 0,
  left: isMobile ? 0 : "auto",
  width: isMobile ? "100%" : 440,
  minWidth: isMobile ? "100%" : 400,
  maxHeight: isMobile ? "90vh" : "100%",
  background: COLORS.surface,
  borderLeft: isMobile ? "none" : `1px solid ${COLORS.border}`,
  borderTop: isMobile ? `1px solid ${COLORS.border}` : "none",
  borderRadius: isMobile ? "28px 28px 0 0" : "0",
  display: "flex",
  flexDirection: "column",
  boxShadow: isMobile ? "0 -8px 40px rgba(15,23,42,0.13)" : "-8px 0 40px rgba(15,23,42,0.08)",
  zIndex: 500,
  animation: isMobile ? "slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)" : "slideRight 0.28s cubic-bezier(0.34,1.56,0.64,1)",
});

const panelStyles = {
  wrap: {
    width: 440,
    minWidth: 400,
    background: COLORS.surface,
    borderLeft: `1px solid ${COLORS.border}`,
    display: "flex",
    flexDirection: "column",
    height: "100%",
    boxShadow: "-8px 0 40px rgba(15,23,42,0.08)",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "20px 24px", borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0,
    background: "linear-gradient(135deg, #f7f9fd 0%, #ffffff 100%)",
  },
  closeBtn: {
    background: COLORS.surfaceHigh, border: `1.5px solid ${COLORS.border}`,
    color: COLORS.textMuted, cursor: "pointer", padding: "9px", borderRadius: 10,
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.15s",
    width: 36, height: 36,
  },
  card: {
    padding: "20px 24px", borderBottom: `1px solid ${COLORS.border}`,
    transition: "background 0.15s",
  },
  cardTop: {
    display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10,
  },
  section: { padding: "18px 24px 0" },
  label: {
    display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
    color: COLORS.textMuted, marginBottom: 10, textTransform: "uppercase",
  },
  input: {
    width: "100%", background: COLORS.surfaceHigh, border: `1.5px solid ${COLORS.border}`,
    borderRadius: 12, color: COLORS.text, padding: "13px 16px",
    fontSize: 14, outline: "none", transition: "border-color 0.2s, box-shadow 0.2s",
    boxSizing: "border-box",
  },
  infoBox: {
    background: COLORS.surfaceHigh, border: `1.5px solid ${COLORS.border}`,
    borderRadius: 14, padding: "16px 18px",
  },
};