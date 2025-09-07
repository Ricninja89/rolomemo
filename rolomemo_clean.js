// @ts-nocheck
import React, { useMemo, useRef, useState, useEffect } from "react";

/*
  RoloMemo — concept grafico (preview interattiva)
  ------------------------------------------------
  - Estetica: ufficio anni '60 (avocado, arancio bruciato, crema, grigio fumo)
  - Interazione: rotellina = scorrimento rotativo tipo Rolodex
  - Audio: "click" meccanico ad ogni scatto (sintetizzato via WebAudio, no asset esterni)
  - Obiettivo: mostrare l'idea visual + microinterazioni. Non è un prodotto finito.
*/

// Palette anni '60 (design token rapidi)
const TOKENS = {
  cream: "#fff7ea",
  avocado: "#7a8f3c",
  burnt: "#c1542a",
  ink: "#1d1d1f",
  smoke: "#3b3b40",
  mustard: "#d6a516",
};

/* ==== PERSISTENZA DESKTOP + WEB ==================== */
const STORAGE_KEY = 'rolomemo.payload.v1';

async function persistLoad() {
  try {
    // Ordine priorità: desktop app (Electron/Tauri) > PyWebView > localStorage fallback
    if (window?.desktop?.loadNotes) return await window.desktop.loadNotes();
    if (window?.pywebview?.api?.load) return await window.pywebview.api.load();
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { 
    console.warn('persistLoad error:', e); 
    return null; 
  }
}

async function persistSave(payload) {
  try {
    if (window?.desktop?.saveNotes) return await window.desktop.saveNotes(payload);
    if (window?.pywebview?.api?.save) return await window.pywebview.api.save(payload);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return { ok: true, local: true };
  } catch (e) { 
    console.warn('persistSave error:', e); 
    return { ok: false, error: String(e) }; 
  }
}

// Dati demo (estesi per test prospettiva)
const demoNotes = [
  { title: "Frontale", text: "Questa è la scheda frontale.", color: TOKENS.avocado, tags: ["inbox", "idea"] },
  { title: "Davanti (coricata)", text: "Scheda davanti, coricata.", color: TOKENS.burnt, tags: ["oggi", "todo"] },
  { title: "Dietro", text: "Scheda dietro, archivio.", color: TOKENS.mustard, tags: ["archivio"] },
  { title: "Extra 1", text: "Scheda aggiuntiva", color: TOKENS.avocado, tags: ["todo"] },
  { title: "Extra 2", text: "Scheda aggiuntiva", color: TOKENS.burnt, tags: ["lavoro"] },
  { title: "Extra 3", text: "Scheda aggiuntiva", color: TOKENS.mustard, tags: ["personale"] },
  { title: "Extra 4", text: "Scheda aggiuntiva", color: TOKENS.avocado, tags: ["oggi"] },
  { title: "Extra 5", text: "Scheda aggiuntiva", color: TOKENS.burnt, tags: ["idea"] },
  { title: "Extra 6", text: "Scheda aggiuntiva", color: TOKENS.mustard, tags: ["archivio"] },
];

const COLOR_CHOICES = [TOKENS.avocado, TOKENS.burnt, TOKENS.mustard, TOKENS.cream];

function updateNoteColorPure(arr, idx, color) {
  const i = Number(idx);
  if (!Array.isArray(arr)) return [];
  if (!Number.isFinite(i) || i < 0 || i >= arr.length) return arr.slice();
  return arr.map((it, k) => (k === i ? { ...it, color } : it));
}

// HEX helpers (aggiunta colori custom)
function canonicalHex(input) {
  if (input == null) return null;
  let s = String(input).trim();
  if (!s) return null;
  if (s[0] === '#') s = s.slice(1);
  s = s.replace(/[^0-9a-fA-F]/g, '');
  if (s.length === 3) { s = s.split('').map(ch => ch + ch).join(''); }
  if (s.length !== 6) return null;
  return '#' + s.toUpperCase();
}

function addToPaletteIfNew(setter, hex) {
  setter(prev => (prev.includes(hex) ? prev : [...prev, hex]));
}

// --------- Audio helpers (click meccanico) ---
function planClickTimes(scfg, randFn = Math.random) {
  const base = (v, def) => Number.isFinite(Number(v)) ? Number(v) : def;
  const jitterSec = (ms, jitterMs = 1) => {
    const b = base(ms, 0), j = (randFn() - 0.5) * 2 * (Number(jitterMs) || 0);
    const out = (b + j) / 1000;
    return out > 0 ? out : 0;
  };
  const click = jitterSec(scfg?.clickDownDelayMs ?? 0);
  const bottom = Math.max(click + 0.001, jitterSec(scfg?.bottomOutDelayMs ?? 8));
  const release = Math.max(bottom + 0.001, jitterSec(scfg?.releaseDelayMs ?? 36));
  return [click, bottom, release];
}

function safeTime(ctx, absTime) {
  const t = Number(absTime);
  if (!Number.isFinite(t) || t < 0) return ctx.currentTime;
  return t < ctx.currentTime ? ctx.currentTime : t;
}

function playMechanicClick(ctxRef, scfg = CONFIG.SOUND) {
  if (!scfg || scfg.enabled === false) return;
  const Ctor = (window.AudioContext || window.webkitAudioContext);
  if (!ctxRef.current) {
    if (!Ctor) return;
    ctxRef.current = new Ctor();
  }
  const ctx = ctxRef.current;
  const now = ctx.currentTime;
  const v = (scfg.volume ?? 0.6);

  const noiseBurst = (absTime, freqHz, q, durMs, gainVal) => {
    const bufferSize = 2048;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freqHz; bp.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    src.connect(bp).connect(g).connect(ctx.destination);
    const t0 = safeTime(ctx, absTime);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, gainVal), t0 + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
    src.start(t0);
    src.stop(t0 + Math.max(0.05, durMs / 1000 + 0.02));
  };

  const [dClick] = planClickTimes(scfg);
  const tClick = now + dClick;
  noiseBurst(tClick, (scfg.kHzClick ?? 3.2) * 1000, 6, 18, v * 0.28);
}

// Normalizza angoli in [-180, 180]
function normAngle(deg) {
  let a = ((deg % 360) + 360) % 360;
  if (a > 180) a -= 360;
  return a;
}

// --- Configurazione (parametri regolabili) ---
const CONFIG = {
  PIVOT_RADIUS: 16,
  FRONT: { zLift: 72 },
  AHEAD: { yOffset: 54, rotX: -110, rotY: 0, zLift: -16 },
  BEHIND: { 
    yOffset: -16, yStep: -16, tilt: -10, tiltStep: 10, 
    zBack: 10, zStep: 10, maxVisible: 5, fadeTrail: 2 
  },
  RING: { offsetX: -96, offsetY: 30 },
  SOUND: { 
    enabled: true, volume: 0.6, kHzClick: 3.2, 
    clickDownDelayMs: 0, bottomOutDelayMs: 8, releaseDelayMs: 36, pingHz: 1600 
  },
};

// Calcolo layout: trasformazioni per ruolo
function computeLayout(role, cfg = CONFIG, order = 1) {
  let transform = "";
  let zIndex = 1;
  let opacity = 0.9;

  if (role === "front") {
    transform = `translate(-50%, -100%) translateZ(${cfg.FRONT.zLift}px)`;
    zIndex = 100; opacity = 1;
  } else if (role === "ahead") {
    transform = `translate(-50%, -100%) translateY(${cfg.AHEAD.yOffset}px) translateZ(${cfg.PIVOT_RADIUS}px) rotateX(${cfg.AHEAD.rotX}deg) translateZ(${-cfg.PIVOT_RADIUS}px) rotateY(${cfg.AHEAD.rotY}deg) translateZ(${cfg.AHEAD.zLift}px)`;
    zIndex = 80; opacity = 0.95;
  } else {
    const o = Math.max(1, order);
    const tilt = cfg.BEHIND.tilt + (cfg.BEHIND.tiltStep ?? 0) * (o - 1);
    const zBack = cfg.BEHIND.zBack + (cfg.BEHIND.zStep ?? -28) * (o - 1);
    const yOff = cfg.BEHIND.yOffset + (cfg.BEHIND.yStep ?? 0) * (o - 1);

    transform = `translate(-50%, -100%) translateY(${yOff}px) translateZ(${cfg.PIVOT_RADIUS}px) rotateX(${tilt}deg) translateZ(${-cfg.PIVOT_RADIUS}px) translateZ(${zBack}px)`;
    zIndex = 40 - o;
    let baseOp = Math.max(0.25, 0.6 - 0.06 * (o - 1));
    const mv = cfg.BEHIND.maxVisible ?? 5;
    const ft = cfg.BEHIND.fadeTrail ?? 2;
    let fadeMult = 1;
    if (o > mv) {
      if (o <= mv + ft) {
        const t = (o - mv) / ft;
        fadeMult = Math.max(0, 1 - t);
      } else {
        fadeMult = 0;
      }
    }
    opacity = baseOp * fadeMult;
  }

  return { transform, zIndex, opacity };
}

function isEditable(role, expanded) {
  return role === "front" && !!expanded;
}

// --- Tag helpers ---
function normalizeTagLabel(s) { return (s || "").trim(); }
function eqTag(a, b) { return normalizeTagLabel(a).toLowerCase() === normalizeTagLabel(b).toLowerCase(); }
function computeAllTags(notes) {
  const map = new Map();
  for (const n of notes) {
    const arr = n.tags || [];
    for (const t of arr) {
      const key = normalizeTagLabel(t).toLowerCase();
      if (key && !map.has(key)) map.set(key, normalizeTagLabel(t));
    }
  }
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
}
function computeTagCounts(notes) {
  const counts = new Map();
  for (const n of notes) (n.tags||[]).forEach(t=>{
    const k = normalizeTagLabel(t).toLowerCase();
    counts.set(k, (counts.get(k)||0)+1);
  });
  return counts;
}

// --- Test di sviluppo ---
function runDevTests() {
  const results = [];
  const test = (name, cond, details) => results.push({ name, pass: !!cond, details });

  test("normAngle(0) === 0", normAngle(0) === 0);
  test("normAngle(350) === -10", normAngle(350) === -10, String(normAngle(350)));
  test("normAngle(10) === 10", normAngle(10) === 10, String(normAngle(10)));

  const Lf = computeLayout("front");
  test("front: opacity=1", Lf.opacity === 1, String(Lf.opacity));
  test("front: has translateZ", /translateZ\(/.test(Lf.transform), Lf.transform);
  test("front: is upright (no rotateX)", !/rotateX\(/.test(Lf.transform), Lf.transform);

  const La = computeLayout("ahead");
  test("ahead: uses rotateX", /rotateX\(/.test(La.transform), La.transform);
  test("ahead: no diagonal roll (rotY 0)", /rotateY\(0deg\)/.test(La.transform), La.transform);

  const Lb = computeLayout("behind");
  test("behind: pushed back (translateZ)", /translateZ\(/.test(Lb.transform), Lb.transform);

  return results;
}

// --- COMPONENTE PRINCIPALE ---
export default function RoloMemo() {
  const [notes, setNotes] = useState(demoNotes);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [palette, setPalette] = useState(COLOR_CHOICES);
  const [tagFilter, setTagFilter] = useState("");
  const [showTests, setShowTests] = useState(false);
  
  const audioCtxRef = useRef(null);
  const ringRef = useRef(null);
  const saveTimer = useRef(null);

  // Auto-save con debounce
  const scheduleSave = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const payload = { notes, currentIndex, palette };
      await persistSave(payload);
      console.log('RoloMemo: dati salvati automaticamente');
    }, 1000);
  };

  // Carica dati all'avvio
  useEffect(() => {
    const loadData = async () => {
      const data = await persistLoad();
      if (data && data.notes) {
        setNotes(data.notes);
        setCurrentIndex(data.currentIndex || 0);
        setPalette(data.palette || COLOR_CHOICES);
        console.log('RoloMemo: dati caricati');
      }
    };
    loadData();
  }, []);

  // Salva quando cambiano i dati
  useEffect(() => {
    scheduleSave();
  }, [notes, currentIndex, palette]);

  // Note filtrate per tag
  const filteredNotes = useMemo(() => {
    if (!tagFilter.trim()) return notes;
    const filter = normalizeTagLabel(tagFilter).toLowerCase();
    return notes.filter(n => 
      (n.tags || []).some(t => 
        normalizeTagLabel(t).toLowerCase().includes(filter)
      )
    );
  }, [notes, tagFilter]);

  const allTags = useMemo(() => computeAllTags(notes), [notes]);
  const tagCounts = useMemo(() => computeTagCounts(notes), [notes]);

  // Navigazione
  const rotateToIndex = (newIndex) => {
    if (newIndex < 0 || newIndex >= filteredNotes.length) return;
    if (newIndex !== currentIndex) {
      playMechanicClick(audioCtxRef);
      setCurrentIndex(newIndex);
      setExpandedIndex(null);
    }
  };

  // Gestori eventi
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 : -1;
    const newIndex = (currentIndex + delta + filteredNotes.length) % filteredNotes.length;
    rotateToIndex(newIndex);
  };

  const handleCardClick = (index) => {
    if (index === currentIndex) {
      setExpandedIndex(expandedIndex === index ? null : index);
    } else {
      rotateToIndex(index);
    }
  };

  // CRUD operations
  const addNote = () => {
    const newNote = {
      title: "Nuova Nota",
      text: "Scrivi qui...",
      color: palette[0] || TOKENS.avocado,
      tags: []
    };
    setNotes(prev => [...prev, newNote]);
    setCurrentIndex(notes.length);
    setExpandedIndex(notes.length);
  };

  const updateNote = (index, field, value) => {
    if (index < 0 || index >= notes.length) return;
    setNotes(prev => prev.map((note, i) => 
      i === index ? { ...note, [field]: value } : note
    ));
  };

  const deleteNote = (index) => {
    if (notes.length <= 1) return;
    setNotes(prev => prev.filter((_, i) => i !== index));
    if (currentIndex >= notes.length - 1) {
      setCurrentIndex(Math.max(0, notes.length - 2));
    }
    setExpandedIndex(null);
  };

  // Ruoli delle schede
  const computeRoles = () => {
    const roles = new Map();
    filteredNotes.forEach((_, i) => {
      if (i === currentIndex) {
        roles.set(i, "front");
      } else if (i === (currentIndex + 1) % filteredNotes.length) {
        roles.set(i, "ahead");
      } else {
        const behind = (i - currentIndex + filteredNotes.length) % filteredNotes.length;
        roles.set(i, { role: "behind", order: behind > filteredNotes.length / 2 ? 
          filteredNotes.length - behind : behind });
      }
    });
    return roles;
  };

  const roles = computeRoles();
  const testResults = showTests ? runDevTests() : [];

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: TOKENS.cream }}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: TOKENS.ink }}>
            RoloMemo
          </h1>
          <p className="text-sm" style={{ color: TOKENS.smoke }}>
            {filteredNotes.length} schede • Indice: {currentIndex + 1}
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={addNote}
            className="px-4 py-2 rounded text-white font-medium"
            style={{ backgroundColor: TOKENS.avocado }}
          >
            + Nuova Scheda
          </button>
          <button
            onClick={() => setShowTests(!showTests)}
            className="px-3 py-2 rounded text-xs border"
            style={{ borderColor: TOKENS.smoke, color: TOKENS.smoke }}
          >
            {showTests ? 'Nascondi Test' : 'Test'}
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Tag */}
        <div className="w-48 shrink-0">
          <div className="sticky top-4">
            <h3 className="font-semibold mb-3" style={{ color: TOKENS.ink }}>
              Filtra per Tag
            </h3>
            
            <input
              type="text"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              placeholder="cerca tag..."
              className="w-full px-3 py-2 rounded border mb-3"
              style={{ borderColor: TOKENS.smoke }}
            />
            
            {tagFilter && (
              <button
                onClick={() => setTagFilter("")}
                className="text-xs mb-3 underline"
                style={{ color: TOKENS.burnt }}
              >
                Rimuovi filtro
              </button>
            )}

            <div className="space-y-1 max-h-60 overflow-y-auto">
              {allTags.map(tag => {
                const count = tagCounts.get(tag.toLowerCase()) || 0;
                const isActive = tagFilter && normalizeTagLabel(tagFilter)
                  .toLowerCase().includes(tag.toLowerCase());
                
                return (
                  <button
                    key={tag}
                    onClick={() => setTagFilter(isActive ? "" : tag)}
                    className={`w-full text-left px-2 py-1 rounded text-xs ${
                      isActive ? 'font-semibold' : ''
                    }`}
                    style={{ 
                      backgroundColor: isActive ? TOKENS.mustard : 'transparent',
                      color: isActive ? 'white' : TOKENS.smoke 
                    }}
                  >
                    {tag} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Area principale RoloMemo */}
        <div className="flex-1 relative">
          <div 
            ref={ringRef}
            className="relative mx-auto"
            style={{
              height: "500px",
              perspective: "1000px",
              transformStyle: "preserve-3d",
              transform: `translate(${CONFIG.RING.offsetX}px, ${CONFIG.RING.offsetY}px)`
            }}
            onWheel={handleWheel}
          >
            {filteredNotes.map((note, index) => {
              const roleData = roles.get(index);
              const role = typeof roleData === "string" ? roleData : roleData?.role;
              const order = typeof roleData === "object" ? roleData?.order : 1;
              const layout = computeLayout(role, CONFIG, order);
              const isExpanded = expandedIndex === index;
              const canEdit = isEditable(role, isExpanded);

              return (
                <div
                  key={index}
                  className="absolute cursor-pointer transition-all duration-300"
                  style={{
                    width: "280px",
                    height: isExpanded ? "400px" : "160px",
                    left: "50%",
                    top: "50%",
                    transform: layout.transform,
                    zIndex: layout.zIndex,
                    opacity: layout.opacity,
                    transformStyle: "preserve-3d",
                  }}
                  onClick={() => handleCardClick(index)}
                >
                  {/* Scheda */}
                  <div
                    className="w-full h-full rounded-lg shadow-lg p-4 border-2"
                    style={{
                      backgroundColor: note.color || TOKENS.cream,
                      borderColor: role === "front" ? TOKENS.ink : "transparent",
                    }}
                  >
                    {/* Titolo */}
                    {canEdit ? (
                      <input
                        type="text"
                        value={note.title || ""}
                        onChange={(e) => updateNote(index, "title", e.target.value)}
                        className="w-full bg-transparent border-b-2 border-dashed font-semibold mb-3"
                        style={{ borderColor: TOKENS.ink, color: TOKENS.ink }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <h3 className="font-semibold mb-2 truncate" style={{ color: TOKENS.ink }}>
                        {note.title || "Senza titolo"}
                      </h3>
                    )}

                    {/* Testo */}
                    {canEdit ? (
                      <textarea
                        value={note.text || ""}
                        onChange={(e) => updateNote(index, "text", e.target.value)}
                        className="w-full h-32 bg-transparent resize-none"
                        style={{ color: TOKENS.smoke }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <p className="text-sm line-clamp-3" style={{ color: TOKENS.smoke }}>
                        {note.text || "Nessun testo"}
                      </p>
                    )}

                    {/* Tags */}
                    <div className="mt-auto">
                      {(note.tags || []).map((tag, tagIdx) => (
                        <span
                          key={tagIdx}
                          className="inline-block px-2 py-1 rounded text-xs mr-1 mb-1"
                          style={{ 
                            backgroundColor: TOKENS.smoke + '20', 
                            color: TOKENS.smoke 
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Controlli (solo su frontale espansa) */}
                    {canEdit && (
                      <div className="mt-4 pt-3 border-t flex gap-2" 
                           style={{ borderColor: TOKENS.smoke + '30' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteNote(index); }}
                          className="text-xs px-2 py-1 rounded"
                          style={{ backgroundColor: TOKENS.burnt, color: 'white' }}
                        >
                          Elimina
                        </button>
                        
                        <select
                          value={note.color || ""}
                          onChange={(e) => updateNote(index, "color", e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs px-2 py-1 rounded"
                        >
                          {palette.map(color => (
                            <option key={color} value={color}>{color}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Istruzioni */}
          <div className="mt-8 text-center text-sm" style={{ color: TOKENS.smoke }}>
            <p>Usa la rotellina del mouse per ruotare • Clicca per espandere</p>
            <p>Schede: {filteredNotes.length} {tagFilter ? `(filtrate: "${tagFilter}")` : ''}</p>
          </div>
        </div>
      </div>

      {/* Test Results */}
      {showTests && (
        <div className="mt-8 p-4 rounded" style={{ backgroundColor: TOKENS.smoke + '10' }}>
          <h3 className="font-semibold mb-3">Test di Sviluppo</h3>
          <div className="text-xs space-y-1">
            {testResults.map((result, i) => (
              <div key={i} className="flex gap-2">
                <span className={result.pass ? "text-green-600" : "text-red-600"}>
                  {result.pass ? "✓" : "✗"}
                </span>
                <span>{result.name}</span>
                {result.details && <span className="text-gray-500">({result.details})</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}