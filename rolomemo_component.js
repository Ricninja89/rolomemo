// rolomemo_component.js — RoloMemo (build desktop, fedele al concept)
// Usa JSX tramite Babel UMD dentro PyWebView

const { useState, useEffect, useMemo, useRef } = React;

/* ===========================
   Design tokens anni '60
   =========================== */
const TOKENS = {
  cream: "#fff7ea",
  avocado: "#7a8f3c",
  burnt: "#c1542a",
  ink: "#1d1d1f",
  smoke: "#3b3b40",
  mustard: "#d6a516",
};

/* ===========================
   Persistenza (pywebview + fallback localStorage)
   =========================== */
const STORAGE_KEY = "rolomemo.payload.v1";

function withTimestamp(payload) {
  try {
    return { ...payload, updatedAt: Date.now() };
  } catch (_) {
    return payload;
  }
}

function waitForPywebviewApi(timeout = 2000) {
  return new Promise(resolve => {
    if (window?.pywebview?.api) return resolve(true);
    let done = false;
    const cleanup = () => {
      done = true;
      try { window.removeEventListener('pywebviewready', onReady); } catch (_) {}
      clearInterval(intv);
      clearTimeout(to);
    };
    const onReady = () => { if (!done) { cleanup(); resolve(true); } };
    try { window.addEventListener('pywebviewready', onReady, { once: true }); } catch (_) {}
    const intv = setInterval(() => {
      if (window?.pywebview?.api) { cleanup(); resolve(true); }
    }, 50);
    const to = setTimeout(() => { cleanup(); resolve(!!(window?.pywebview?.api)); }, timeout);
  });
}
async function persistLoad() {
  try {
    let fileData = null;
    // Attendi che l'API pywebview sia pronta prima di decidere il fallback
    try { await waitForPywebviewApi(2000); } catch (_) {}
    if (window?.pywebview?.api?.load) {
      try { fileData = await window.pywebview.api.load(); } catch (_) { fileData = null; }
    }
    const raw = (() => { try { return localStorage.getItem(STORAGE_KEY); } catch (_) { return null } })();
    const localData = raw ? JSON.parse(raw) : null;
    const fileTs = fileData && typeof fileData.updatedAt === 'number' ? fileData.updatedAt : 0;
    const localTs = localData && typeof localData.updatedAt === 'number' ? localData.updatedAt : 0;
    const chosen = fileTs >= localTs ? (fileData || localData) : (localData || fileData);
    // Se local è più recente, prova a sincronizzare su file
    if (chosen === localData && localTs > fileTs && window?.pywebview?.api?.save) {
      try { await window.pywebview.api.save(localData); } catch (_) {}
    }
    return chosen || null;
  } catch (e) {
    console.warn("persistLoad", e);
    return null;
  }
}
async function persistSave(payload) {
  const data = withTimestamp(payload);
  try {
    // Aggiorna sempre localStorage per durabilità in chiusura
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
    if (window?.pywebview?.api?.save) {
      return await window.pywebview.api.save(data);
    }
    return { ok: true, local: true };
  } catch (e) {
    console.warn("persistSave", e);
    return { ok: false, error: String(e) };
  }
}

/* ===========================
   Dati demo iniziali (verranno sovrascritti dal load)
   =========================== */
const demoNotes = [
  {
    title: "Benvenuto 👋",
    text: "Scorri con la rotellina del mouse per sfogliare le note. La scheda centrale è la ‘frontale’. Doppio click su di lei per espanderla e modificarla.",
    color: TOKENS.avocado,
    tags: ["guida", "onboarding"]
  },
  {
    title: "Rotellina = Rolomemo",
    text: "Muovi la rotella: le schede ruotano attorno a un fulcro, come un Rolodex. Ogni scatto fa un ‘click’ meccanico (puoi attivarlo/disattivarlo col pulsante 🔊 in alto).",
    color: TOKENS.mustard,
    tags: ["guida"]
  },
  {
    title: "Nuova nota",
    text: "Clicca ‘＋ Nuova’ per creare subito una scheda: viene messa davanti e si apre in modalità espansa per scrivere al volo.",
    color: TOKENS.burnt,
    tags: ["guida", "note"]
  },
  {
    title: "Modifica & Tag",
    text: "Nella nota espansa puoi cambiare titolo e testo. Aggiungi tag con l’input ‘aggiungi tag’ in basso: appariranno come #tag sulla card.",
    color: TOKENS.cream,
    tags: ["guida", "tag"]
  },
  {
    title: "Colori",
    text: "Scegli un colore cliccando i pallini. Aggiungi un colore personalizzato inserendo un codice HEX (es. #A1B2C3).",
    color: TOKENS.avocado,
    tags: ["guida", "stile"]
  },
  {
    title: "Filtra per tag",
    text: "Nella colonna a destra trovi i tag esistenti: clicca per filtrare le note. Su schermi stretti apri il menu ☰ e usa la stessa sezione lì.",
    color: TOKENS.mustard,
    tags: ["guida", "tag"]
  },
  {
    title: "Layout: Rolomemo / Griglia",
    text: "Puoi passare dal layout Rolomemo alla Griglia verticale con i bottoni 🗂️/☷ sopra ai tag (o dal menu mobile).",
    color: TOKENS.cream,
    tags: ["guida", "layout"]
  },
  {
    title: "Elimina & Salvataggio",
    text: "In modalità espansa trovi il pulsante ‘Elimina’. Le modifiche vengono salvate automaticamente sul tuo PC.",
    color: TOKENS.burnt,
    tags: ["guida", "salvataggio"]
  }
];

const COLOR_CHOICES_BASE = [TOKENS.avocado, TOKENS.burnt, TOKENS.mustard, TOKENS.cream];

/* ===========================
   Audio: click meccanico (solo tick secco)
   =========================== */
function planClickTimes(scfg, randFn = Math.random) {
  const base = (v, def) => (Number.isFinite(Number(v)) ? Number(v) : def);
  const jitterSec = (ms, jitterMs = 1) => {
    const b = base(ms, 0);
    const j = (randFn() - 0.5) * 2 * (Number(jitterMs) || 0);
    const out = (b + j) / 1000;
    return out > 0 ? out : 0; // clamp >= 0
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
function playMechanicClick(ctxRef, scfg) {
  if (!scfg || scfg.enabled === false) return;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return;
  if (!ctxRef.current) ctxRef.current = new Ctor();
  const ctx = ctxRef.current;
  const now = ctx.currentTime;
  const v = scfg.volume ?? 0.6;
  // rumore bandpass brevissimo
  const noiseBurst = (absTime, freqHz, q, durMs, gainVal) => {
    const bufferSize = 2048;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = freqHz; bp.Q.value = q;
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
  noiseBurst(now + dClick, (scfg.kHzClick ?? 3.2) * 1000, 6, 18, v * 0.28);
}

/* ===========================
   Config "inversomile"
   =========================== */
const CONFIG = {
  PIVOT_RADIUS: 16,
  FRONT: { zLift: 72 },
  AHEAD: { yOffset: 200, rotX: -110, rotY: 0, zLift: -16 },
  BEHIND: {
    yOffset: -28,
    yStep: -28,
    tilt: 2,
    tiltStep: 2,
    zBack: 5,
    zStep: -10,
    maxVisible: 5,
    fadeTrail: 2,
  },
  RING: { offsetX: 0, offsetY: 30 },
  SOUND: { enabled: true, volume: 0.6, kHzClick: 3.2, clickDownDelayMs: 0, bottomOutDelayMs: 8, releaseDelayMs: 36 },
};

/* ===========================
   Layout helpers
   =========================== */
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
    // Prospettiva: piu' indietro -> piu' piccolo (non invasivo, configurabile)
    const scaleStep = cfg.BEHIND.scaleStep ?? 0.07;
    const scaleMin  = cfg.BEHIND.scaleMin  ?? 0.72;
    const scale = Math.max(scaleMin, 1 - scaleStep * (o - 1));

    transform = `translate(-50%, -100%) translateY(${yOff}px) translateZ(${cfg.PIVOT_RADIUS}px) rotateX(${tilt}deg) translateZ(${-cfg.PIVOT_RADIUS}px) translateZ(${zBack}px) scale(${scale})`;
    zIndex = 40 - o;
    const mv = cfg.BEHIND.maxVisible ?? 5;
    const ft = cfg.BEHIND.fadeTrail ?? 2;
    let fade = 1; // piena opacità per le card "dietro" visibili
    if (o > mv) {
      if (o <= mv + ft) {
        const t = (o - mv) / ft; // 0..1
        fade = Math.max(0, 1 - t); // dissolve solo oltre maxVisible
      } else {
        fade = 0; // completamente nascosta oltre la coda
      }
    }
    opacity = fade;
  }
  return { transform, zIndex, opacity };
}
const isEditable = (role, expanded) => role === "front" && !!expanded;

/* ===========================
   Tag helpers
   =========================== */
const normTag = s => (s || "").trim();
const eqTag = (a, b) => normTag(a).toLowerCase() === normTag(b).toLowerCase();
function computeAllTags(notes) {
  const m = new Map();
  for (const n of notes) for (const t of (n.tags || [])) {
    const k = normTag(t).toLowerCase();
    if (k && !m.has(k)) m.set(k, normTag(t));
  }
  return Array.from(m.values()).sort((a, b) => a.localeCompare(b));
}
function computeTagCounts(notes) {
  const c = new Map();
  for (const n of notes) for (const t of (n.tags || [])) {
    const k = normTag(t).toLowerCase();
    c.set(k, (c.get(k) || 0) + 1);
  }
  return c;
}

/* ===========================
   Componente principale
   =========================== */
function RoloMemo() {
  const [notes, setNotes] = useState(demoNotes);
  const [currentIndex, setCurrentIndex] = useState(0);       // indice nel filtrato
  const [expandedIndex, setExpandedIndex] = useState(null);  // se front espansa
  const [palette, setPalette] = useState(COLOR_CHOICES_BASE);
  const [tagFilter, setTagFilter] = useState("");
  const [sound, setSound] = useState(true);
  const [layout, setLayout] = useState("rolomemo");
  const [menuOpen, setMenuOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const audioCtxRef = useRef(null);
  const ringRef = useRef(null);
  const saveTimer = useRef(null);

  // Carica payload
  useEffect(() => {
    (async () => {
      const data = await persistLoad();
      if (data && Array.isArray(data.notes) && data.notes.length) {
        setNotes(data.notes);
        setCurrentIndex(Math.min(data.currentIndex || 0, Math.max(0, (data.notes.length || 1) - 1)));
        setPalette(Array.isArray(data.palette) && data.palette.length ? data.palette : COLOR_CHOICES_BASE);
        setLayout((data && data.layout) ? data.layout : "rolomemo");
      } else {
        // Primo avvio o archivio vuoto → seed onboarding
        setNotes(demoNotes);
        setCurrentIndex(0);
        setPalette(COLOR_CHOICES_BASE);
        setLayout("rolomemo");
      }
      setLoaded(true);
    })();
  }, []);

  // Auto-save debounce
  const scheduleSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persistSave({ notes, currentIndex, palette, layout });
    }, 600);
  };
  useEffect(() => { if (loaded) scheduleSave(); }, [notes, currentIndex, palette, layout, loaded]);

  // Flush su chiusura/hidden: scrive subito su localStorage e prova a salvare su file
  useEffect(() => {
    const flush = () => {
      try {
        const payload = { notes, currentIndex, palette, layout, updatedAt: Date.now() };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch (_) {}
        if (window?.pywebview?.api?.save) { try { window.pywebview.api.save(payload); } catch (_) {} }
      } catch (_) {}
    };
    const onVis = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [notes, currentIndex, palette, layout]);

  // Filtraggio tag (substring case-insensitive)
  const filteredNotes = useMemo(() => {
    const f = normTag(tagFilter).toLowerCase();
    if (!f) return notes;
    return notes.filter(n => (n.tags || []).some(t => normTag(t).toLowerCase().includes(f)));
  }, [notes, tagFilter]);

  // Mappa ruoli: front, ahead, behind(n) — ordine sequenziale
  const roles = useMemo(() => {
    const map = new Map();
    const len = filteredNotes.length || 1;
    for (let i = 0; i < len; i++) {
      if (i === currentIndex) { map.set(i, "front"); continue; }
      const rel = (i - currentIndex - 1 + len) % len; // 0 = ahead, poi 1,2,3... = behind
      if (rel === 0) map.set(i, "ahead"); else map.set(i, { role: "behind", order: rel });
    }
    return map;
  }, [filteredNotes, currentIndex]);

  // Scroll solo quando il mouse è sopra il ring
  const handleWheel = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!filteredNotes.length) return;
    const delta = e.deltaY > 0 ? 1 : -1;
    const next = (currentIndex + delta + filteredNotes.length) % filteredNotes.length;
    if (next !== currentIndex) {
      if (sound) playMechanicClick(audioCtxRef, CONFIG.SOUND);
      setCurrentIndex(next);
      setExpandedIndex(null);
    }
  };

  // Click/doppio-click card
  const handleCardClick = (i) => {
    if (i === currentIndex) return; // singolo click sulla frontale: nessuna azione
    setCurrentIndex(i);
    setExpandedIndex(null);
    if (sound) playMechanicClick(audioCtxRef, CONFIG.SOUND);
  };
  const handleCardDoubleClick = (i) => {
    if (i === currentIndex) setExpandedIndex(expandedIndex === i ? null : i);
  };

  // CRUD note
  const addNote = () => {
    const newOne = { title: "Nuova Nota", text: "Scrivi qui…", color: palette[0] || TOKENS.avocado, tags: [] };
    if (tagFilter) setTagFilter("");
    setNotes(prev => [newOne, ...prev]);
    setCurrentIndex(0);
    setExpandedIndex(0);
  };
  const filteredIndexToGlobal = (fi) => {
    const f = filteredNotes[fi];
    if (!f) return null;
    const gi = notes.indexOf(f);
    if (gi >= 0) return gi;
    return notes.findIndex(n => n.title === f.title && n.text === f.text && n.color === f.color);
  };
  const updateNote = (fi, field, value) => {
    const idx = filteredIndexToGlobal(fi);
    if (idx == null) return;
    setNotes(prev => prev.map((n, k) => (k === idx ? { ...n, [field]: value } : n)));
  };
  const deleteNote = (fi) => {
    const idx = filteredIndexToGlobal(fi);
    if (idx == null) return;
    setNotes(prev => prev.filter((_, k) => k !== idx));
    setExpandedIndex(null);
    setCurrentIndex(0);
  };

  // Palette + HEX
  const updateNoteColor = (fi, color) => updateNote(fi, "color", color);
  const addCustomHexToPalette = (hex) => {
    let s = String(hex || "").trim();
    if (!s) return;
    if (s[0] !== "#") s = "#" + s;
    s = s.replace(/[^#0-9a-fA-F]/g, "");
    if (!/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(s)) return;
    if (!palette.includes(s)) setPalette(p => [...p, s]);
  };

  // Tag inside card
  const addTagToNote = (fi, raw) => {
    const t = (raw || "").trim();
    if (!t) return;
    const idx = filteredIndexToGlobal(fi);
    if (idx == null) return;
    setNotes(prev => prev.map((n, k) => (k === idx ? { ...n, tags: Array.from(new Set([...(n.tags || []), t])) } : n)));
  };

  // Tag sidebar
  const allTags = useMemo(() => computeAllTags(notes), [notes]);
  const tagCounts = useMemo(() => computeTagCounts(notes), [notes]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: TOKENS.cream }}>
      {/* Header */}
      <div className="sticky top-0 z-[200] px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: "#e5dfd2", background: TOKENS.cream }}>
        <div className="flex items-center gap-3">
          <div className="flex gap-2 mr-1">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#EA6E6E" }} />
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#EABB5E" }} />
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#7CCB75" }} />
          </div>
          <div className="text-lg font-semibold tracking-wide" style={{ color: TOKENS.ink }}>ROLOMEMO</div>
        </div>
        <div className="flex items-center gap-3">
          <button
            title={sound ? "Audio: ON" : "Audio: OFF"}
            onClick={() => setSound(s => !s)}
            className="rounded-full w-9 h-9 grid place-items-center border"
            style={{ borderColor: "#d4cbb7", color: TOKENS.smoke, background: "#fffaf1" }}
          >
            {sound ? "🔊" : "🔇"}
          </button>
          <button
            onClick={addNote}
            className="px-4 py-2 rounded-full font-medium shadow"
            style={{ background: TOKENS.avocado, color: "#fff" }}
          >
            <span className="mr-1">＋</span><span className="hidden sm:inline">Nuova</span>
          </button>
          <button
            onClick={() => setMenuOpen(s => !s)}
            className="md:hidden rounded-full w-9 h-9 grid place-items-center border"
            style={{ borderColor: "#d4cbb7", color: TOKENS.smoke, background: "#fffaf1" }}
            title="Menu"
            aria-label="Apri menu"
          >☰</button>
        </div>
      </div>

      {/* Corpo: ring + sidebar */}
      <div className="px-6 py-6 grid gap-6 md:grid-cols-[1fr_16rem] grid-cols-1">
        {/* Colonna principale */}
        <div className="relative">
          {layout === "rolomemo" ? (
          <div
            ref={ringRef}
            onWheel={handleWheel}
            className="relative mx-auto"
            style={{
              width: "min(560px, 100%)",
              height: "min(500px, calc(100vh - 240px))",
              perspective: "1000px",
              transformStyle: "preserve-3d",
              transform: `translateY(${CONFIG.RING.offsetY}px)`,
            }}
          >
            {filteredNotes.map((note, i) => {
              const roleData = roles.get(i);
              const role = typeof roleData === "string" ? roleData : roleData?.role;
              const order = typeof roleData === "object" ? roleData?.order : 1;
              const layoutInfo = computeLayout(role, CONFIG, order);
              const isExpanded = expandedIndex === i;
              if (isExpanded) return null;
              return (
                <div
                  key={i}
                  className="absolute transition-all duration-300 cursor-pointer"
                  style={{
                    width: 340,
                    height: 180,
                    left: "50%",
                    top: "50%",
                    transform: layoutInfo.transform,
                    zIndex: layoutInfo.zIndex,
                    opacity: layoutInfo.opacity,
                    transformStyle: "preserve-3d",
                  }}
                  onClick={() => handleCardClick(i)}
                  onDoubleClick={() => handleCardDoubleClick(i)}
                >
                  <div
                    className="w-full h-full rounded-2xl shadow-lg border p-4 flex flex-col"
                    style={{
                      background: note.color || TOKENS.cream,
                      borderColor: role === "front" ? TOKENS.ink : "transparent",
                    }}
                  >
                    <div className="font-bold mb-2" style={{ color: TOKENS.ink }}>{note.title || "Senza titolo"}</div>
                    <div className="line-clamp-3" style={{ color: TOKENS.ink }}>{note.text || "…"}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(note.tags || []).map(t => (
                        <span key={t} className="px-2 py-0.5 rounded-full text-xs" style={{ background: "#ffffff88", color: TOKENS.smoke, border: "1px solid #00000022" }}>
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          ) : (
          <div className="mx-auto" style={{ width: "min(960px, 100%)" }}>
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {filteredNotes.map((note, i) => (
                <div key={i} className="transition-all cursor-pointer rounded-2xl shadow-lg border p-4 flex flex-col"
                  style={{ background: note.color || TOKENS.cream, borderColor: "#00000022" }}
                  onClick={() => setCurrentIndex(i)}
                  onDoubleClick={() => setExpandedIndex(i)}>
                  <div className="font-bold mb-2" style={{ color: TOKENS.ink }}>{note.title || "Senza titolo"}</div>
                  <div className="line-clamp-3 mb-2" style={{ color: TOKENS.ink }}>{note.text || "…"}</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {(note.tags || []).map(t => (
                      <span key={t} className="px-2 py-0.5 rounded-full text-xs" style={{ background: "#ffffff88", color: TOKENS.smoke, border: "1px solid #00000022" }}>#{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* Overlay e card espansa fuori dal ring (no parent transform) */}
          {expandedIndex !== null && (() => {
            const i = expandedIndex;
            const note = filteredNotes[i];
            if (!note) return null;
            return (
              <>
                <div className="fixed inset-0 z-[1900] bg-black/30" onClick={() => setExpandedIndex(null)} />
                <div
                  className="fixed z-[2000] left-1/2"
                  style={{
                    top: "max(80px, 8vh)",
                    transform: "translateX(-50%)",
                    width: "min(760px, 92vw)",
                    height: "min(560px, calc(100vh - 160px))",
                  }}
                >
                  <div
                    className="w-full h-full rounded-2xl shadow-lg border p-4 flex flex-col overflow-auto"
                    style={{ background: note.color || TOKENS.cream, borderColor: TOKENS.ink }}
                    onDoubleClick={() => setExpandedIndex(null)}
                  >
                    <input
                      value={note.title || ""}
                      onChange={e => updateNote(i, "title", e.target.value)}
                      className="w-full bg-transparent border-b font-semibold mb-3 outline-none"
                      style={{ borderColor: "#00000033", color: TOKENS.ink }}
                    />
                    <textarea
                      value={note.text || ""}
                      onChange={e => updateNote(i, "text", e.target.value)}
                      className="flex-1 bg-transparent outline-none resize-none"
                      style={{ color: TOKENS.ink }}
                    />
                    <div className="mt-2 flex flex-wrap gap-2 items-center">
                      {(note.tags || []).map(t => (
                        <span key={t} className="px-2 py-0.5 rounded-full text-xs" style={{ background: "#ffffff88", color: TOKENS.smoke, border: "1px solid #00000022" }}>
                          #{t}
                        </span>
                      ))}
                      {/* input aggiungi tag spostato accanto ai tag esistenti */}
                      <input
                        type="text"
                        placeholder="aggiungi tag"
                        onClick={e => e.stopPropagation()}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            addTagToNote(i, e.currentTarget.value);
                            e.currentTarget.value = "";
                          }
                        }}
                        className="px-2 py-1 text-xs rounded border bg-white/70 inline-block"
                        style={{ borderColor: "#00000022", color: TOKENS.smoke, width: 120 }}
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {palette.map(col => (
                          <button
                            key={col}
                            onClick={(e) => { e.stopPropagation(); updateNoteColor(i, col); }}
                            className="w-5 h-5 rounded-full border"
                            style={{ background: col, borderColor: "#00000022" }}
                            title={"Colore " + col}
                          />
                        ))}
                        <input
                          type="text"
                          placeholder="#A1B2C3"
                          onClick={e => e.stopPropagation()}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              addCustomHexToPalette(e.currentTarget.value);
                              e.currentTarget.value = "";
                            }
                          }}
                          className="w-24 px-2 py-1 text-xs rounded border bg-white/70"
                          style={{ borderColor: "#00000022", color: TOKENS.smoke }}
                        />
                      </div>
                      <div>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteNote(i); }}
                          className="px-2 py-1 rounded text-xs border"
                          style={{ borderColor: "#8b1a1a", color: "#8b1a1a", background: "#fff5f5" }}
                          title="Elimina nota"
                        >
                          Elimina
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}

          {/* footer “powered by” */}
          <div className="mt-4 text-xs" style={{ color: TOKENS.smoke }}>
            <a href="https://www.digitalezen.it/" target="_blank" rel="noreferrer" className="underline">
              powered by digitalezen.it
            </a>
          </div>
        </div>

        {/* Sidebar tag */}
        <aside className="hidden md:block rounded-xl border p-3 h-fit sticky top-20" style={{ borderColor: "#e5dfd2", background: "#fffaf1" }}>
          {/* Switch layout */}
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider" style={{ color: TOKENS.smoke }}>Layout</span>
            <div className="flex gap-2">
              <button
                onClick={() => setLayout("rolomemo")}
                className={`w-8 h-8 rounded border grid place-items-center ${layout === "rolomemo" ? "font-semibold" : ""}`}
                style={{ borderColor: "#e5dfd2", background: layout === "rolomemo" ? TOKENS.mustard : "transparent", color: layout === "rolomemo" ? "#fff" : TOKENS.smoke }}
                title="Rolomemo"
                aria-label="Rolomemo"
              >🗂️</button>
              <button
                onClick={() => setLayout("grid")}
                className={`w-8 h-8 rounded border grid place-items-center ${layout === "grid" ? "font-semibold" : ""}`}
                style={{ borderColor: "#e5dfd2", background: layout === "grid" ? TOKENS.mustard : "transparent", color: layout === "grid" ? "#fff" : TOKENS.smoke }}
                title="Griglia"
                aria-label="Griglia"
              >☷</button>
            </div>
          </div>
          <div className="text-sm font-semibold mb-2" style={{ color: TOKENS.ink }}>Tag</div>
          <button
            onClick={() => setTagFilter("")}
            className={`w-full text-left px-3 py-2 rounded border mb-2 ${tagFilter ? "" : "font-semibold"}`}
            style={{ borderColor: "#e5dfd2", background: tagFilter ? "transparent" : TOKENS.mustard, color: tagFilter ? TOKENS.smoke : "#fff" }}
          >
            Tutti <span className="float-right opacity-70">{notes.length}</span>
          </button>
          <div className="flex flex-col gap-2 max-h-[60vh] overflow-auto pr-1">
            {allTags.map(tag => {
              const count = tagCounts.get(tag.toLowerCase()) || 0;
              const active = tagFilter && normTag(tagFilter).toLowerCase().includes(tag.toLowerCase());
              return (
                <button
                  key={tag}
                  onClick={() => setTagFilter(active ? "" : tag)}
                  className={`w-full text-left px-3 py-2 rounded border text-sm ${active ? "font-semibold" : ""}`}
                  style={{ borderColor: "#e5dfd2", background: active ? TOKENS.mustard : "transparent", color: active ? "#fff" : TOKENS.smoke }}
                >
                  #{tag}
                  <span className="float-right opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Drawer mobile: layout + tag */}
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-[1800] bg-black/30" onClick={() => setMenuOpen(false)} />
            <div className="fixed z-[1850] left-3 right-3 top-[72px] bottom-3 rounded-xl border p-3 overflow-auto" style={{ borderColor: "#e5dfd2", background: "#fffaf1" }}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider" style={{ color: TOKENS.smoke }}>Layout</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setLayout("rolomemo"); setMenuOpen(false); }}
                    className={`w-8 h-8 rounded border grid place-items-center ${layout === "rolomemo" ? "font-semibold" : ""}`}
                    style={{ borderColor: "#e5dfd2", background: layout === "rolomemo" ? TOKENS.mustard : "transparent", color: layout === "rolomemo" ? "#fff" : TOKENS.smoke }}
                    title="Rolomemo"
                    aria-label="Rolomemo"
                  >🗂️</button>
                  <button
                    onClick={() => { setLayout("grid"); setMenuOpen(false); }}
                    className={`w-8 h-8 rounded border grid place-items-center ${layout === "grid" ? "font-semibold" : ""}`}
                    style={{ borderColor: "#e5dfd2", background: layout === "grid" ? TOKENS.mustard : "transparent", color: layout === "grid" ? "#fff" : TOKENS.smoke }}
                    title="Griglia"
                    aria-label="Griglia"
                  >☷</button>
                </div>
              </div>

              <div className="text-sm font-semibold mb-2" style={{ color: TOKENS.ink }}>Tag</div>
              <button
                onClick={() => { setTagFilter(""); setMenuOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded border mb-2 ${tagFilter ? "" : "font-semibold"}`}
                style={{ borderColor: "#e5dfd2", background: tagFilter ? "transparent" : TOKENS.mustard, color: tagFilter ? TOKENS.smoke : "#fff" }}
              >
                Tutti <span className="float-right opacity-70">{notes.length}</span>
              </button>

              <div className="flex flex-col gap-2" style={{ maxHeight: "calc(100% - 120px)", overflow: "auto" }}>
                {allTags.map(tag => {
                  const count = tagCounts.get(tag.toLowerCase()) || 0;
                  const active = tagFilter && normTag(tagFilter).toLowerCase().includes(tag.toLowerCase());
                  return (
                    <button
                      key={tag}
                      onClick={() => { setTagFilter(active ? "" : tag); setMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded border text-sm ${active ? "font-semibold" : ""}`}
                      style={{ borderColor: "#e5dfd2", background: active ? TOKENS.mustard : "transparent", color: active ? "#fff" : TOKENS.smoke }}
                    >
                      #{tag}
                      <span className="float-right opacity-70">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
