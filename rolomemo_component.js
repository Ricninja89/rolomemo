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

// Temi: Retro (default), Dark, Zen
const THEMES = {
  retro: {
    cream: "#fff7ea",
    avocado: "#7a8f3c",
    burnt: "#c1542a",
    ink: "#1d1d1f",
    smoke: "#3b3b40",
    mustard: "#d6a516",
    bg: "#fff7ea",
    panel: "#fffaf1",
  },
  dark: {
    cream: "#121212",
    avocado: "#5a7a2f",
    burnt: "#b04328",
    ink: "#f2f2f2",
    smoke: "#c7c7c7",
    mustard: "#c8a21a",
    bg: "#0f0f0f",
    panel: "#1a1a1a",
  },
  zen: {
    cream: "#f6fbff",
    avocado: "#77bfa3",
    burnt: "#ee8572",
    ink: "#24323a",
    smoke: "#6f8793",
    mustard: "#a0c4ff",
    bg: "#f6fbff",
    panel: "#ffffff",
  }
};

function themeDefaultPalette(name) {
  const t = THEMES[name] || THEMES.retro;
  if (name === 'dark') return [t.burnt, t.avocado, t.mustard, "#334155"];
  if (name === 'zen') return [t.avocado, t.mustard, "#ffd6a5", "#caffbf"];
  return [t.avocado, t.burnt, t.mustard, t.cream];
}

function applyThemeCssVars(name) {
  const t = THEMES[name] || THEMES.retro;
  try {
    const r = document.documentElement;
    r.style.setProperty('--color-cream', t.cream);
    r.style.setProperty('--color-avocado', t.avocado);
    r.style.setProperty('--color-burnt', t.burnt);
    r.style.setProperty('--color-ink', t.ink);
    r.style.setProperty('--color-smoke', t.smoke);
    r.style.setProperty('--color-mustard', t.mustard);
  } catch (_) {}
}

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
  const [useCustomPalette, setUseCustomPalette] = useState(false);
  const [theme, setTheme] = useState('retro');
  const [tagFilter, setTagFilter] = useState("");
  const [sound, setSound] = useState(true);
  const [layout, setLayout] = useState("rolomemo");
  const [menuOpen, setMenuOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Tag aggiuntivi definiti dall'utente (non necessariamente presenti nelle note)
  const [extraTags, setExtraTags] = useState([]);
  // Stato per apertura impostazioni (popup in implementazione 3)
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Stato configurazione app (caricata da backend Python)
  const [appConfig, setAppConfig] = useState(null);
  const [cfgLoading, setCfgLoading] = useState(false);
  const [cfgError, setCfgError] = useState("");
  // Avvio automatico (Windows)
  const [autoStart, setAutoStart] = useState(null); // null = sconosciuto
  const [autoStartBusy, setAutoStartBusy] = useState(false);
  const [autoStartError, setAutoStartError] = useState("");
  // Chiudi suggerimenti tag al cambio scheda espansa
  useEffect(() => { setTagSuggestOpen(false); setTagQuery(""); }, [expandedIndex]);

  const loadConfig = async () => {
    setCfgLoading(true);
    setCfgError("");
    try {
      await waitForPywebviewApi(1000);
      if (window?.pywebview?.api?.get_config) {
        const cfg = await window.pywebview.api.get_config();
        setAppConfig(cfg || null);
        try {
          const t = String(cfg?.app?.theme || '').toLowerCase();
          if (t && (t in THEMES)) setTheme(t);
        } catch(_){}
      } else {
        setAppConfig(null);
      }
      // Stato avvio automatico
      if (window?.pywebview?.api?.get_auto_start_status) {
        try {
          const st = await window.pywebview.api.get_auto_start_status();
          if (st && st.ok !== false) setAutoStart(!!st.enabled);
        } catch (_) { /* ignore */ }
      }
    } catch (e) {
      setCfgError(String(e));
    } finally {
      setCfgLoading(false);
    }
  };

  const updateConfigPart = async (updates) => {
    try {
      // merge superficiale su root e su app
      setAppConfig(prev => ({
        ...(prev || {}),
        ...updates,
        app: { ...((prev && prev.app) || {}), ...(updates.app || {}) },
      }));
      await waitForPywebviewApi(1000);
      if (window?.pywebview?.api?.update_config) {
        await window.pywebview.api.update_config(updates);
      }
    } catch (_) { /* silent */ }
  };

  // Carica config quando si apre la finestra impostazioni
  useEffect(() => {
    if (settingsOpen) {
      loadConfig();
    }
  }, [settingsOpen]);

  // ESC per chiudere la finestra impostazioni
  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setSettingsOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settingsOpen]);

  const setAutoStartEnabled = async (enabled) => {
    setAutoStartBusy(true);
    setAutoStartError("");
    try {
      await waitForPywebviewApi(1000);
      if (window?.pywebview?.api?.set_auto_start) {
        const res = await window.pywebview.api.set_auto_start(!!enabled);
        if (res && res.ok !== false) {
          setAutoStart(!!enabled);
          // aggiorna anche la config locale
          updateConfigPart({ app: { auto_start: !!enabled } });
        } else {
          setAutoStartError(res?.error || 'Operazione non riuscita');
        }
      }
    } catch (e) {
      setAutoStartError(String(e));
    } finally {
      setAutoStartBusy(false);
    }
  };

  const audioCtxRef = useRef(null);
  const ringRef = useRef(null);
  const saveTimer = useRef(null);
  const suppressNextSave = useRef(false);
  const editorRefs = useRef(new Map());
  const [ctxMenu, setCtxMenu] = useState({ open: false, x: 0, y: 0, index: null });
  // Input tag (nota espansa): query e popup suggerimenti
  const [tagQuery, setTagQuery] = useState("");
  const [tagSuggestOpen, setTagSuggestOpen] = useState(false);
  const tagInputRef = useRef(null);
  const tagSuggestCloseTimer = useRef(null);
  const [tagSuggestPos, setTagSuggestPos] = useState({ x: 0, y: 0, w: 0 });
  const updateTagSuggestPos = () => {
    try {
      const el = tagInputRef.current; if (!el) return;
      const r = el.getBoundingClientRect();
      setTagSuggestPos({ x: r.left, y: r.bottom, w: r.width });
    } catch(_) {}
  };
  useEffect(() => {
    if (!tagSuggestOpen) return;
    const onScroll = () => updateTagSuggestPos();
    const onResize = () => updateTagSuggestPos();
    updateTagSuggestPos();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [tagSuggestOpen]);

  // Carica payload
  useEffect(() => {
    (async () => {
      // Loader smart: preferisci file per evitare overwrite da localStorage demo
      let data = null;
      try {
        try { await waitForPywebviewApi(2000); } catch (_) {}
        let fileData = null;
        if (window?.pywebview?.api?.load) {
          try { fileData = await window.pywebview.api.load(); } catch (_) { fileData = null; }
        }
        const raw = (() => { try { return localStorage.getItem(STORAGE_KEY); } catch (_) { return null } })();
        const localData = raw ? JSON.parse(raw) : null;
        const fileTs = fileData && typeof fileData.updatedAt === 'number' ? fileData.updatedAt : 0;
        const localTs = localData && typeof localData.updatedAt === 'number' ? localData.updatedAt : 0;
        const fileHas = !!(fileData && Array.isArray(fileData.notes) && fileData.notes.length);
        const localHas = !!(localData && Array.isArray(localData.notes) && localData.notes.length);
        const isDemo = (p) => { try { const ns = Array.isArray(p?.notes) ? p.notes : []; if (!ns.length) return false; const t = new Set(ns.map(n => String(n?.title||'').toLowerCase())); return t.has('benvenuto ??') || t.has('rotellina = rolomemo') || t.has('nuova nota'); } catch(_) { return false; } };
        if (fileHas) { if (localHas && localTs > fileTs && !isDemo(localData)) { data = localData; } else { data = fileData; } }
        else if (localHas) { data = localData; }
        else { data = fileTs >= localTs ? (fileData || localData) : (localData || fileData); }
      } catch (_) { data = null; }
      if (data && Array.isArray(data.notes) && data.notes.length) {
        setNotes(data.notes);
        setCurrentIndex(Math.min(data.currentIndex || 0, Math.max(0, (data.notes.length || 1) - 1)));
        const themeFromData = (data && data.theme && (data.theme in THEMES)) ? data.theme : null;
        const useCustomFromData = !!data.useCustomPalette;
        if (themeFromData) setTheme(themeFromData); else setTheme('retro');
        setUseCustomPalette(useCustomFromData);
        if (useCustomFromData && Array.isArray(data.palette) && data.palette.length) {
          setPalette(data.palette);
        } else {
          setPalette(themeDefaultPalette(themeFromData || 'retro'));
        }
        setLayout((data && data.layout) ? data.layout : "rolomemo");
        setExtraTags(Array.isArray(data.extraTags) ? data.extraTags : []);
      } else {
        // Primo avvio o archivio vuoto → seed onboarding
        setNotes(demoNotes);
        setCurrentIndex(0);
        setTheme('retro');
        setUseCustomPalette(false);
        setPalette(themeDefaultPalette('retro'));
        setLayout("rolomemo");
        setExtraTags([]);
      }
      // Evita il primo autosave dopo il load
      suppressNextSave.current = true;
      setLoaded(true);
    })();
  }, []);

  // Auto-save debounce
  const scheduleSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (suppressNextSave.current) { suppressNextSave.current = false; return; }
      persistSave({ notes, currentIndex, palette, layout, extraTags, theme, useCustomPalette });
    }, 600);
  };
  useEffect(() => { if (loaded) scheduleSave(); }, [notes, currentIndex, palette, layout, extraTags, loaded]);

  // Flush su chiusura/hidden: scrive subito su localStorage e prova a salvare su file
  useEffect(() => {
    const flush = () => {
      try {
        const payload = { notes, currentIndex, palette, layout, extraTags, theme, useCustomPalette, updatedAt: Date.now() };
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
  }, [notes, currentIndex, palette, layout, extraTags]);
  
  // Applica CSS vars del tema
  useEffect(() => {
    applyThemeCssVars(theme);
  }, [theme]);

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

  // Tag sidebar: unione dei tag presenti nelle note + extra definiti dall'utente
  const allTags = useMemo(() => {
    const fromNotes = computeAllTags(notes);
    const extra = Array.isArray(extraTags) ? extraTags : [];
    const merged = Array.from(new Set([...fromNotes, ...extra.map(normTag)])).filter(Boolean);
    return merged.sort((a, b) => a.localeCompare(b));
  }, [notes, extraTags]);
  const tagCounts = useMemo(() => computeTagCounts(notes), [notes]);

  // ===== Editor helpers =====
  const wrapSelection = (fi, before, after) => {
    const ta = editorRefs.current.get(fi);
    if (!ta) return;
    const start = ta.selectionStart || 0;
    const end = ta.selectionEnd || 0;
    const val = ta.value;
    const sel = val.slice(start, end);
    const next = val.slice(0, start) + before + sel + after + val.slice(end);
    updateNote(fi, 'text', next);
    setTimeout(() => {
      const pos = start + before.length + sel.length;
      try { ta.focus(); ta.setSelectionRange(pos, pos); } catch(_){}
    }, 0);
  };
  const formatSelection = (fi, kind) => {
    if (kind === 'bold') return wrapSelection(fi, '**', '**');
    if (kind === 'italic') return wrapSelection(fi, '_', '_');
    if (kind === 'underline') return wrapSelection(fi, '<u>', '</u>');
  };
  const getLineInfo = (ta) => {
    const pos = ta.selectionStart || 0;
    const val = ta.value;
    const lineStart = val.lastIndexOf('\n', pos - 1) + 1;
    const lineEnd = val.indexOf('\n', pos);
    const end = lineEnd === -1 ? val.length : lineEnd;
    return { pos, val, lineStart, end };
  };
  const toggleListAtSelection = (fi) => {
    const ta = editorRefs.current.get(fi);
    if (!ta) return;
    const { val, lineStart, end } = getLineInfo(ta);
    const line = val.slice(lineStart, end);
    let repl;
    if (/^\s*-\s/.test(line)) repl = line.replace(/^\s*-\s?/, '');
    else repl = '- ' + line;
    const next = val.slice(0, lineStart) + repl + val.slice(end);
    const shift = repl.length - line.length;
    const caret = (ta.selectionStart || 0) + shift;
    updateNote(fi, 'text', next);
    setTimeout(() => { try { ta.focus(); ta.setSelectionRange(caret, caret); } catch(_){} }, 0);
  };
  const indentList = (fi, outdent=false) => {
    const ta = editorRefs.current.get(fi);
    if (!ta) return;
    const { val, lineStart, end } = getLineInfo(ta);
    const line = val.slice(lineStart, end);
    let repl = line;
    if (outdent) repl = line.replace(/^\s{0,2}-\s?/, '- ');
    else repl = line.replace(/^\s*(-\s?)/, '- - ');
    const next = val.slice(0, lineStart) + repl + val.slice(end);
    const shift = repl.length - line.length;
    const caret = (ta.selectionStart || 0) + shift;
    updateNote(fi, 'text', next);
    setTimeout(() => { try { ta.focus(); ta.setSelectionRange(caret, caret); } catch(_){} }, 0);
  };
  const handleEditorKeyDown = (e, fi) => {
    // kept for legacy (textarea) – no longer used
  };
  const handleEditorKeyDownRich = (e, fi) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); document.execCommand('bold'); handleEditorHtmlChange(fi); return; }
    if (mod && (e.key === 'i' || e.key === 'I')) { e.preventDefault(); document.execCommand('italic'); handleEditorHtmlChange(fi); return; }
    if (mod && (e.key === 'u' || e.key === 'U')) { e.preventDefault(); document.execCommand('underline'); handleEditorHtmlChange(fi); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand(e.shiftKey ? 'outdent' : 'indent');
      handleEditorHtmlChange(fi);
    }
  };

  const toggleBulletList = (fi) => {
    const el = editorRefs.current.get(fi); if (!el) return;
    el.focus();
    // Assicura che la selezione sia dentro il contentEditable
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    // Se siamo dentro un LI, togli il bullet da quella riga
    let node = sel.anchorNode;
    while (node && node !== el && node.nodeType === 3) node = node.parentNode;
    let liAncestor = null; let p = node;
    while (p && p !== el) { if (p.tagName === 'LI') { liAncestor = p; break; } p = p.parentNode; }
    if (liAncestor) {
      const ul = liAncestor.parentNode;
      const frag = document.createElement('span');
      frag.innerHTML = liAncestor.innerHTML || '';
      ul.replaceChild(frag, liAncestor);
      if (ul.children.length === 0) ul.parentNode.removeChild(ul);
      const r = document.createRange(); r.selectNodeContents(frag); r.collapse(false);
      sel.removeAllRanges(); sel.addRange(r);
      handleEditorHtmlChange(fi); return;
    }

    const before = el.innerHTML;
    try { document.execCommand('insertUnorderedList'); } catch(_) {}
    setTimeout(() => {
      const after = el.innerHTML;
      if (before === after) {
        // Fallback manuale: wrappa selezione in <ul><li>
        try {
          const sel2 = window.getSelection();
          if (!sel2 || sel2.rangeCount === 0) { handleEditorHtmlChange(fi); return; }
          const range = sel2.getRangeAt(0);
          const frag = range.cloneContents();
          const temp = document.createElement('div'); temp.appendChild(frag);
          const selected = temp.innerHTML.trim();
          range.deleteContents();
          const ul = document.createElement('ul');
          const li = document.createElement('li');
          li.innerHTML = selected || '<br>';
          ul.appendChild(li);
          range.insertNode(ul);
          // caret alla fine del LI
          sel2.removeAllRanges();
          const nrange = document.createRange();
          nrange.selectNodeContents(li);
          nrange.collapse(false);
          sel2.addRange(nrange);
        } catch (_) {}
      }
      handleEditorHtmlChange(fi);
    }, 0);
  };

  const sanitizeHtml = (html) => {
    try {
      const tmp = document.createElement('div'); tmp.innerHTML = html || '';
      const allowed = new Set(['B','STRONG','I','EM','U','UL','OL','LI','BR','P','SPAN','DIV','CODE']);
      const walker = (node) => {
        const kids = Array.from(node.childNodes);
        for (const k of kids) {
          if (k.nodeType === 1) { // element
            if (!allowed.has(k.tagName)) {
              // unwrap element but keep children
              while (k.firstChild) node.insertBefore(k.firstChild, k);
              node.removeChild(k);
              continue;
            }
            // strip attributes (except style limited)
            const keepStyle = k.getAttribute('style');
            k.removeAttribute('class');
            k.removeAttribute('id');
            for (const attr of Array.from(k.attributes)) {
              if (attr.name.startsWith('on')) k.removeAttribute(attr.name);
            }
            if (keepStyle) k.setAttribute('style', keepStyle);
            walker(k);
          } else if (k.nodeType === 8) { // comment
            node.removeChild(k);
          }
        }
      };
      walker(tmp);
      return tmp.innerHTML;
    } catch (_) { return String(html || ''); }
  };

  const escapeHtml = (text) => {
    try {
      const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
      return String(text || '').replace(/[&<>"']/g, (c) => map[c]);
    } catch(_) { return String(text || ''); }
  };

  // Preview sicura e leggibile nelle card a partire dal contenuto HTML della nota
  const makePreviewHtml = (src) => {
    try {
      const hasTags = typeof src === 'string' && src.indexOf('<') !== -1 && src.indexOf('>') !== -1;
      const base = hasTags ? sanitizeHtml(src) : escapeHtml(src).replace(/\n/g, '<br>');
      const tmp = document.createElement('div');
      tmp.innerHTML = base;

      // Liste → righe con bullet, preservando markup inline
      tmp.querySelectorAll('ul, ol').forEach(list => {
        const isOl = list.tagName === 'OL';
        const frag = document.createDocumentFragment();
        let idx = 1;
        const items = Array.from(list.children).filter(ch => ch.tagName === 'LI');
        items.forEach(li => {
          const line = document.createElement('span');
          const bullet = isOl ? (idx++ + '. ') : '• ';
          line.appendChild(document.createTextNode(bullet));
          const inner = document.createElement('span');
          inner.innerHTML = sanitizeHtml(li.innerHTML);
          Array.from(inner.childNodes).forEach(n => line.appendChild(n));
          frag.appendChild(line);
          frag.appendChild(document.createElement('br'));
        });
        list.replaceWith(frag);
      });

      // Unwrap P/DIV mantenendo interruzioni di riga
      tmp.querySelectorAll('p, div').forEach(el => {
        const frag = document.createDocumentFragment();
        while (el.firstChild) frag.appendChild(el.firstChild);
        const br = document.createElement('br');
        const hasSibling = !!el.nextSibling;
        el.replaceWith(frag);
        if (hasSibling) tmp.appendChild(br);
      });

      // Rimuovi attributi di presentazione residui per sicurezza della preview
      tmp.querySelectorAll('*').forEach(node => {
        if (node.nodeType === 1) {
          node.removeAttribute('style');
          node.removeAttribute('class');
          node.removeAttribute('id');
          Array.from(node.attributes).forEach(a => { if (a.name.startsWith('on')) node.removeAttribute(a.name); });
        }
      });

      // Normalizza BR multipli e whitespace
      let html = tmp.innerHTML
        .replace(/(<br\s*\/?>(\s|&nbsp;)*){3,}/gi, '<br><br>')
        .replace(/\n+/g, ' ')
        .trim();

      // Hard limit: caratteri e interruzioni per assicurare altezza costante
      const MAX_CHARS = 320;
      const MAX_BREAKS = 2; // al massimo 3 righe totali

      // Limita i <br> a MAX_BREAKS
      const parts = html.split(/<br\s*\/?>(?:\s|&nbsp;)*?/i);
      if (parts.length > MAX_BREAKS + 1) {
        html = parts.slice(0, MAX_BREAKS + 1).join('<br>') + ' ' + parts.slice(MAX_BREAKS + 1).join(' ');
      }

      // Se eccede in caratteri, fallback a testo semplice troncato + ellissi (mantiene clamp visivo)
      const plain = tmp.textContent.replace(/\s+/g, ' ').trim();
      if (plain.length > MAX_CHARS) {
        return escapeHtml(plain.slice(0, MAX_CHARS).trim()) + '&hellip;';
      }

      return html;
    } catch(_) {
      return escapeHtml(src || '');
    }
  };

  // ------ Allegati ------
  const getAttachments = (note) => {
    const arr = Array.isArray(note?.attachments) ? note.attachments : [];
    return arr.filter(a => a && (a.url || a.path || a.href));
  };
  const attachmentCount = (note) => getAttachments(note).length;
  const attDisplayName = (att) => {
    const n = att?.name || '';
    const u = att?.url || att?.path || att?.href || '';
    if (n) return String(n);
    try { const p = u.split(/[\\/]/).pop(); return p || u; } catch(_) { return String(u||'allegato'); }
  };
  const attKind = (att) => {
    const u = (att?.mime || '').toLowerCase() || String(att?.url||att?.path||att?.href||'').toLowerCase();
    if (/(\.png|\.jpe?g|\.gif|\.webp|\.bmp)$/.test(u) || /image\//.test(u)) return 'image';
    if (/(\.mp4|\.webm|\.mkv|\.mov)$/.test(u) || /video\//.test(u)) return 'video';
    if (/(\.mp3|\.wav|\.ogg|\.m4a)$/.test(u) || /audio\//.test(u)) return 'audio';
    if (/\.pdf$/.test(u) || /application\/pdf/.test(u)) return 'pdf';
    return 'file';
  };
  const [previewAtt, setPreviewAtt] = useState(null);
  const openAttachment = async (att) => {
    try {
      const kind = attKind(att);
      const url = att?.url || att?.path || att?.href;
      if (!url) return;
      if (kind === 'image' || kind === 'video' || kind === 'audio' || kind === 'pdf') {
        setPreviewAtt({ ...att, kind, url });
        return;
      }
      if (window.pywebview?.api?.open_path) {
        await window.pywebview.api.open_path(url);
      } else {
        window.open(url, '_blank');
      }
    } catch(_) {}
  };

  const guessMimeFromPath = (p) => {
    const low = String(p || '').toLowerCase();
    if (low.match(/\.(png|jpe?g|gif|webp|bmp)$/)) return 'image/*';
    if (low.match(/\.(mp4|webm|mkv|mov)$/)) return 'video/*';
    if (low.match(/\.(mp3|wav|ogg|m4a)$/)) return 'audio/*';
    return 'application/octet-stream';
  };
  const addAttachmentsToNote = async (fi) => {
    try {
      if (!window.pywebview?.api?.pick_attachments) return;
      const res = await window.pywebview.api.pick_attachments();
      if (!res || !res.ok) return;
      const files = Array.isArray(res.files) ? res.files : [];
      if (files.length === 0) return;
      const idx = filteredIndexToGlobal(fi);
      if (idx == null) return;
      // Assicura un id stabile per la nota
      let noteId = notes[idx]?.id;
      if (!noteId) {
        noteId = 'n_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
        setNotes(prev => prev.map((n, k) => (k === idx ? { ...n, id: noteId } : n)));
      }
      // Copia i file nel vault allegati appdata
      if (window.pywebview?.api?.copy_attachments) {
        const copyRes = await window.pywebview.api.copy_attachments(noteId, files);
        if (copyRes && copyRes.ok && Array.isArray(copyRes.items)) {
          const add = copyRes.items.map(it => ({ name: it.name, path: it.path, url: it.url, mime: it.mime }));
          setNotes(prev => prev.map((n, k) => (k === idx ? { ...n, attachments: [...(n.attachments || []), ...add] } : n)));
          return;
        }
      }
      // Fallback: linka direttamente ai path scelti
      const add = files.map(fp => ({ name: fp.split(/[/\\]/).pop(), path: fp, url: fp, mime: guessMimeFromPath(fp) }));
      setNotes(prev => prev.map((n, k) => (k === idx ? { ...n, attachments: [...(n.attachments || []), ...add] } : n)));
    } catch(_) {}
  };
  const removeAttachmentFromNote = (fi, attIndex) => {
    const idx = filteredIndexToGlobal(fi);
    if (idx == null) return;
    setNotes(prev => prev.map((n, k) => (k === idx ? { ...n, attachments: (n.attachments || []).filter((_, j) => j !== attIndex) } : n)));
  };

  const handleEditorHtmlChange = (fi) => {
    const el = editorRefs.current.get(fi); if (!el) return;
    try {
      el.querySelectorAll('ul').forEach(u => { u.style.listStyleType = 'disc'; u.style.paddingLeft = '1.25rem'; u.style.margin = '0.25rem 0'; });
      el.querySelectorAll('li').forEach(li => { li.style.marginLeft = '0.25rem'; });
    } catch(_){}
    const safe = sanitizeHtml(el.innerHTML);
    updateNote(fi, 'text', safe);
  };
  const handleEditorPaste = (e, fi) => {
    try {
      const html = e.clipboardData.getData('text/html');
      const text = e.clipboardData.getData('text/plain');
      if (html) {
        e.preventDefault();
        const safe = sanitizeHtml(html);
        document.execCommand('insertHTML', false, safe);
        handleEditorHtmlChange(fi);
      } else if (text) {
        e.preventDefault();
        document.execCommand('insertText', false, text);
        handleEditorHtmlChange(fi);
      }
    } catch (_) {}
  };
  // Context menu
  const handleEditorContextMenu = (e, fi) => {
    e.preventDefault();
    setCtxMenu({ open: true, x: e.clientX, y: e.clientY, index: fi });
  };
  const execCmd = (cmd, fi) => {
    const el = editorRefs.current.get(fi);
    if (!el) return;
    if (cmd === 'selectAll') { el.focus(); document.execCommand('selectAll'); return; }
    if (cmd === 'copy' || cmd === 'cut') {
      try { document.execCommand(cmd); } catch(_){}
      return;
    }
    if (cmd === 'paste') {
      // Prova prima Clipboard API, altrimenti fallback
      const insertText = (text) => {
        try {
          if (!text) return;
          el.focus();
          if (!document.execCommand('insertText', false, text)) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
              const range = sel.getRangeAt(0);
              range.deleteContents();
              range.insertNode(document.createTextNode(text));
            }
          }
        } catch(_) {}
        handleEditorHtmlChange(fi);
      };
      try {
        if (navigator && navigator.clipboard && navigator.clipboard.readText) {
          navigator.clipboard.readText().then(t => insertText(t)).catch(() => { try { document.execCommand('paste'); handleEditorHtmlChange(fi); } catch(_){} });
        } else {
          try { document.execCommand('paste'); handleEditorHtmlChange(fi); } catch(_){}
        }
      } catch(_) { try { document.execCommand('paste'); handleEditorHtmlChange(fi); } catch(_){} }
    }
  };
  // Gestione tag nella sidebar
  const addSidebarTag = (raw) => {
    const t = normTag(raw).trim();
    if (!t) return;
    const lowered = t.toLowerCase();
    const exists = allTags.some(x => x.toLowerCase() === lowered);
    if (exists) return;
    setExtraTags(prev => [...prev, t]);
  };
  const deleteSidebarTag = (tag) => {
    const t = normTag(tag);
    const tl = t.toLowerCase();
    setExtraTags(prev => prev.filter(x => x.toLowerCase() !== tl));
    setNotes(prev => prev.map(n => ({
      ...n,
      tags: (n.tags || []).filter(x => normTag(x).toLowerCase() !== tl)
    })));
    if (tagFilter && normTag(tagFilter).toLowerCase().includes(tl)) setTagFilter("");
  };

  // Toolbar component (inline)
  function EditorToolbar({ onBold, onItalic, onUnderline, onBullet }) {
    return (
      <div className="mb-2 flex items-center gap-2">
        <button type="button" onClick={(e)=>{e.preventDefault(); onBold&&onBold();}} className="px-2 py-1 text-xs rounded border" style={{ borderColor: '#00000022', background: '#fff' }} title="Grassetto (Ctrl+B)"><b>B</b></button>
        <button type="button" onClick={(e)=>{e.preventDefault(); onItalic&&onItalic();}} className="px-2 py-1 text-xs rounded border italic" style={{ borderColor: '#00000022', background: '#fff' }} title="Corsivo (Ctrl+I)">I</button>
        <button type="button" onClick={(e)=>{e.preventDefault(); onUnderline&&onUnderline();}} className="px-2 py-1 text-xs rounded border underline" style={{ borderColor: '#00000022', background: '#fff' }} title="Sottolineato (Ctrl+U)">U</button>
        <button type="button" onClick={(e)=>{e.preventDefault(); onBullet&&onBullet();}} className="px-2 py-1 text-xs rounded border" style={{ borderColor: '#00000022', background: '#fff' }} title="Elenco puntato (-, Tab)">• List</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: THEMES[theme]?.bg || TOKENS.cream }}>
      {/* Header */}
      <div className="sticky top-0 z-[200] px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: "#e5dfd2", background: THEMES[theme]?.panel || TOKENS.cream }}>
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
            onClick={() => setSettingsOpen(true)}
            className="rounded-full w-9 h-9 grid place-items-center border"
            style={{ borderColor: "#d4cbb7", color: TOKENS.smoke, background: "#fffaf1" }}
            title="Impostazioni"
            aria-label="Apri impostazioni"
          >⚙️</button>
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
                    <div className="line-clamp-3" style={{ color: TOKENS.ink }} dangerouslySetInnerHTML={{ __html: makePreviewHtml(note.text || '') || '&hellip;' }} />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(note.tags || []).map(t => (
                        <span key={t} className="px-2 py-0.5 rounded-full text-xs" style={{ background: "#ffffff88", color: TOKENS.smoke, border: "1px solid #00000022" }}>
                          #{t}
                        </span>
                      ))}
                      {attachmentCount(note) > 0 && (
                        <span className="ml-auto px-2 py-0.5 rounded-full text-xs flex items-center gap-1" style={{ background: "#ffffff88", color: TOKENS.smoke, border: "1px solid #00000022" }} title="Allegati">
                          <span>📎</span>
                          <span>{attachmentCount(note)}</span>
                        </span>
                      )}
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
                  <div className="line-clamp-3 mb-2" style={{ color: TOKENS.ink }} dangerouslySetInnerHTML={{ __html: makePreviewHtml(note.text || '') || '&hellip;' }} />
                  <div className="mt-1 flex flex-wrap gap-2">
                    {(note.tags || []).map(t => (
                      <span key={t} className="px-2 py-0.5 rounded-full text-xs" style={{ background: "#ffffff88", color: TOKENS.smoke, border: "1px solid #00000022" }}>#{t}</span>
                    ))}
                    {attachmentCount(note) > 0 && (
                      <span className="ml-auto px-2 py-0.5 rounded-full text-xs flex items-center gap-1" style={{ background: "#ffffff88", color: TOKENS.smoke, border: "1px solid #00000022" }} title="Allegati">
                        <span>📎</span>
                        <span>{attachmentCount(note)}</span>
                      </span>
                    )}
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
                <div className="fixed inset-0 z-[1900] bg-black/30" onClick={() => { setCtxMenu({open:false,x:0,y:0,index:null}); setExpandedIndex(null); }} />
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
                    {/* Toolbar editor */}
                    <EditorToolbar
                      onBold={() => { const el = editorRefs.current.get(i); if (el) { el.focus(); document.execCommand('bold'); handleEditorHtmlChange(i); } }}
                      onItalic={() => { const el = editorRefs.current.get(i); if (el) { el.focus(); document.execCommand('italic'); handleEditorHtmlChange(i); } }}
                      onUnderline={() => { const el = editorRefs.current.get(i); if (el) { el.focus(); document.execCommand('underline'); handleEditorHtmlChange(i); } }}
                      onBullet={() => toggleBulletList(i)}
                    />
                    <input
                      value={note.title || ""}
                      onChange={e => updateNote(i, "title", e.target.value)}
                      className="w-full bg-transparent border-b font-semibold mb-3 outline-none"
                      style={{ borderColor: "#00000033", color: TOKENS.ink }}
                    />
                    <div
                      ref={el => { if (el) { editorRefs.current.set(i, el); if (el.innerHTML !== (note.text || '')) el.innerHTML = sanitizeHtml(note.text || ''); } }}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={() => handleEditorHtmlChange(i)}
                      onKeyDown={e => handleEditorKeyDownRich(e, i)}
                      onPaste={e => handleEditorPaste(e, i)}
                      onContextMenu={e => handleEditorContextMenu(e, i)}
                      className="flex-1 bg-transparent outline-none"
                      style={{ color: TOKENS.ink, whiteSpace: 'pre-wrap', cursor: 'text' }}
                    />
                    <div className="mt-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs" style={{ color: TOKENS.smoke }}>Allegati ({attachmentCount(note)})</div>
                        <div>
                          <button className="px-2 py-1 rounded border text-xs" style={{ borderColor: '#00000022', color: TOKENS.smoke, background: '#fff' }} onClick={(e) => { e.stopPropagation(); addAttachmentsToNote(i); }}>
                            + Aggiungi allegato
                          </button>
                        </div>
                      </div>
                      {getAttachments(note).length > 0 && (
                        <ul className="pl-5 mt-1" style={{ listStyleType: 'disc' }}>
                          {getAttachments(note).map((att, idx) => (
                            <li key={idx} className="mb-1 flex items-center gap-2">
                              <button
                                className="underline text-sm"
                                style={{ color: TOKENS.ink }}
                                onClick={(e) => { e.stopPropagation(); openAttachment(att); }}
                                title={attDisplayName(att)}
                              >
                                {attKind(att) === 'image' ? '🖼️' : attKind(att) === 'video' ? '🎞️' : attKind(att) === 'audio' ? '🎵' : attKind(att) === 'pdf' ? '📄' : '📎'}{' '}
                                {attDisplayName(att)}
                              </button>
                              <button className="text-xs rounded border px-1" style={{ borderColor: '#e5dfd2' }} title="Scarica" onClick={async (e) => { e.stopPropagation(); try { await window.pywebview?.api?.save_attachment?.(att.path || att.url, attDisplayName(att)); } catch(_){} }}>⬇</button>
                              <button className="text-xs rounded border px-1" style={{ borderColor: '#e5dfd2', color: '#8b1a1a' }} onClick={(e) => { e.stopPropagation(); removeAttachmentFromNote(i, idx); }} title="Rimuovi">✕</button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 items-center">
                      {(note.tags || []).map(t => (
                        <span key={t} className="px-2 py-0.5 rounded-full text-xs flex items-center gap-1" style={{ background: "#ffffff88", color: TOKENS.smoke, border: "1px solid #00000022" }}>
                          <span>#{t}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); const tl = String(t); const gi = filteredIndexToGlobal(i); if (gi!=null) setNotes(prev => prev.map((n,k)=> k===gi ? { ...n, tags: (n.tags||[]).filter(x=> normTag(x).toLowerCase() !== normTag(tl).toLowerCase()) } : n)); }}
                            className="w-4 h-4 grid place-items-center rounded-full border"
                            style={{ borderColor: "#00000022", color: "#8b1a1a" }}
                            title="Rimuovi tag"
                          >×</button>
                        </span>
                      ))}
                      {/* input tag con suggerimenti */}
                      <div className="relative inline-block">
                        <input
                          ref={tagInputRef}
                          type="text"
                          placeholder="aggiungi tag"
                          value={tagQuery}
                          onChange={(e)=>{ setTagQuery(e.target.value); setTagSuggestOpen(true); updateTagSuggestPos(); }}
                          onFocus={()=> { setTagSuggestOpen(true); updateTagSuggestPos(); }}
                          onClick={e => e.stopPropagation()}
                          onBlur={()=> { tagSuggestCloseTimer.current = setTimeout(()=> setTagSuggestOpen(false), 120); }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const q = normTag(tagQuery);
                              const existing = allTags.find(t => eqTag(t, q));
                              const current = (note.tags||[]).map(x=>normTag(x).toLowerCase());
                              if (existing) {
                                if (!current.includes(normTag(existing).toLowerCase())) addTagToNote(i, existing);
                              } else if (q) {
                                addTagToNote(i, q);
                              }
                              setTagQuery('');
                              setTagSuggestOpen(false);
                            }
                          }}
                          className="px-2 py-1 text-xs rounded border bg-white/70 inline-block"
                          style={{ borderColor: "#00000022", color: TOKENS.smoke, width: 160 }}
                        />
                        {tagSuggestOpen && ReactDOM.createPortal((
                          <div
                            className="rounded border bg-white shadow"
                            style={{ position: 'fixed', left: tagSuggestPos.x, top: tagSuggestPos.y + 2, minWidth: Math.max(160, tagSuggestPos.w), maxHeight: '11rem', overflow: 'auto', zIndex: 2200, borderColor: '#e5dfd2' }}
                            onMouseDown={(e)=>{ if (tagSuggestCloseTimer.current) { clearTimeout(tagSuggestCloseTimer.current); tagSuggestCloseTimer.current=null; } e.preventDefault(); }}
                          >
                            {(() => {
                              const q = normTag(tagQuery);
                              const cur = (note.tags||[]).map(x=> normTag(x).toLowerCase());
                              const matches = allTags.filter(t => t.toLowerCase().includes(q.toLowerCase()) && !cur.includes(normTag(t).toLowerCase())).slice(0, 8);
                              const exact = allTags.some(t => eqTag(t, q));
                              const items = [...matches];
                              if (q && !exact) items.push(`+ aggiungi "${q}"`);
                              if (items.length === 0) return (
                                <div className="px-3 py-2 text-xs" style={{ color: TOKENS.smoke }}>Nessun suggerimento</div>
                              );
                              return items.map((it, idx) => (
                                <button key={idx}
                                  className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                                  onClick={() => {
                                    const q2 = normTag(tagQuery);
                                    if (it.startsWith('+ aggiungi')) {
                                      if (q2) addTagToNote(i, q2);
                                    } else {
                                      addTagToNote(i, it);
                                    }
                                    setTagQuery(''); setTagSuggestOpen(false);
                                    if (tagInputRef.current) try { tagInputRef.current.focus(); } catch(_){}
                                  }}
                                >{it}</button>
                              ));
                            })()}
                          </div>
                        ), document.body)}
                      </div>
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
                        <button
                          onClick={(e) => { e.stopPropagation(); setSettingsOpen(true); }}
                          className="px-2 py-1 rounded border text-xs"
                          style={{ borderColor: "#00000022", color: TOKENS.smoke, background: "#fff" }}
                          title="Gestisci palette in Impostazioni"
                        >🎨 Palette</button>
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
                  {/* Context menu editor dentro l'overlay */}
                  {ctxMenu.open && ctxMenu.index === i && (
                    <div
                      className="fixed bg-white rounded border shadow text-sm"
                      style={{ left: ctxMenu.x + 2, top: ctxMenu.y + 2, borderColor: '#e5dfd2', zIndex: 2147483647 }}
                      onClick={(e)=> e.stopPropagation()}
                      onContextMenu={(e)=> { e.preventDefault(); e.stopPropagation(); }}
                    >
                      {['Copia','Taglia','Incolla','Seleziona tutto'].map((label, idx) => (
                        <button
                          key={idx}
                          className="block w-40 text-left px-3 py-2 hover:bg-gray-100"
                          onClick={() => { const map={ 'Copia':'copy','Taglia':'cut','Incolla':'paste','Seleziona tutto':'selectAll'}; execCmd(map[label], ctxMenu.index); setCtxMenu({open:false,x:0,y:0,index:null}); }}
                        >{label}</button>
                      ))}
                    </div>
          )}

          {previewAtt && ReactDOM.createPortal((
            <div className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.4)', zIndex: 99999 }} onClick={() => setPreviewAtt(null)}>
              <div className="absolute left-1/2 top-1/2 rounded-xl shadow-lg border overflow-hidden"
                   style={{ transform: 'translate(-50%, -50%)', width: 'min(820px, 92vw)', maxHeight: '80vh', background: '#fff', borderColor: '#e5dfd2', zIndex: 100000 }}
                   onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid #e5dfd2', background: '#fffaf1', color: TOKENS.smoke }}>
                  <div className="text-sm font-medium truncate">Anteprima · {attDisplayName(previewAtt)}</div>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-2 py-1 rounded border text-xs"
                      style={{ borderColor: '#e5dfd2' }}
                      title="Scarica"
                      onClick={async () => {
                        try {
                          const src = previewAtt?.path || previewAtt?.url;
                          if (!src) return;
                          await window.pywebview?.api?.save_attachment?.(src, attDisplayName(previewAtt));
                        } catch(_) {}
                      }}
                    >
                      ⬇ Scarica
                    </button>
                    <button className="px-2 py-1 rounded border text-xs" style={{ borderColor: '#e5dfd2' }} onClick={() => setPreviewAtt(null)}>Chiudi</button>
                  </div>
                </div>
                <div className="p-3" style={{ background: '#fff' }}>
                  {previewAtt.kind === 'image' && (
                    <img src={previewAtt.url} alt={attDisplayName(previewAtt)} style={{ maxWidth: '100%', maxHeight: '70vh', display: 'block', margin: '0 auto' }} />
                  )}
                  {previewAtt.kind === 'video' && (
                    <video src={previewAtt.url} controls style={{ width: '100%', maxHeight: '70vh' }} />
                  )}
                  {previewAtt.kind === 'audio' && (
                    <audio src={previewAtt.url} controls style={{ width: '100%' }} />
                  )}
                  {previewAtt.kind === 'pdf' && (
                    <div style={{ width: '100%', height: '70vh' }}>
                      <object data={previewAtt.url} type="application/pdf" style={{ width: '100%', height: '100%' }}>
                        <embed src={previewAtt.url} type="application/pdf" style={{ width: '100%', height: '100%' }} />
                        <div className="text-sm" style={{ color: TOKENS.smoke }}>
                          Anteprima PDF non disponibile. Apri con l'app di sistema?
                          <div className="mt-2"><button className="px-3 py-1 rounded border" style={{ borderColor: '#e5dfd2' }} onClick={async () => { try { await window.pywebview?.api?.open_path?.(previewAtt.url); } catch(_){} }}>Apri</button></div>
                        </div>
                      </object>
                    </div>
                  )}
                  {previewAtt.kind === 'file' && (
                    <div className="text-sm" style={{ color: TOKENS.smoke }}>
                      <p>Impossibile mostrare l'anteprima. Apri con l'app di sistema?</p>
                      <div className="mt-2"><button className="px-3 py-1 rounded border" style={{ borderColor: '#e5dfd2' }} onClick={async () => { try { await window.pywebview?.api?.open_path?.(previewAtt.url); setPreviewAtt(null); } catch(_){} }}>Apri</button></div>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2 px-3 pb-3">
                  <button className="px-2 py-1 rounded border text-xs" style={{ borderColor: '#e5dfd2' }} onClick={async () => {
                    try {
                      const src = previewAtt.path || previewAtt.url;
                      if (!src) return;
                      const res = await window.pywebview?.api?.save_attachment?.(src, attDisplayName(previewAtt));
                      if (res && res.ok && res.saved) {
                        // opzionale: feedback
                      }
                    } catch(_) {}
                  }} title="Scarica">
                    ⬇ Scarica
                  </button>
                </div>
              </div>
            </div>
          ), document.body)}
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
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="nuovo tag"
              className="flex-1 px-2 py-1 text-sm rounded border bg-white/70"
              style={{ borderColor: "#e5dfd2", color: TOKENS.smoke }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addSidebarTag(e.currentTarget.value);
                  e.currentTarget.value = '';
                }
              }}
            />
            <button
              onClick={(e) => {
                const input = e.currentTarget.previousElementSibling;
                if (input && input.value) {
                  addSidebarTag(input.value);
                  input.value = '';
                }
              }}
              className="px-3 py-1 rounded border text-sm"
              style={{ borderColor: "#e5dfd2", background: "#fffaf1", color: TOKENS.smoke }}
              title="Aggiungi tag"
            >+
            </button>
          </div>
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
                <div key={tag} className="flex items-center gap-2">
                  <button
                    onClick={() => setTagFilter(active ? "" : tag)}
                    className={`flex-1 text-left px-3 py-2 rounded border text-sm ${active ? "font-semibold" : ""}`}
                    style={{ borderColor: "#e5dfd2", background: active ? TOKENS.mustard : "transparent", color: active ? "#fff" : TOKENS.smoke }}
                  >
                    #{tag}
                    <span className="float-right opacity-70">{count}</span>
                  </button>
                  <button
                    onClick={() => deleteSidebarTag(tag)}
                    className="w-8 h-8 rounded border grid place-items-center text-sm"
                    style={{ borderColor: "#e5dfd2", background: "#fffaf1", color: "#8b1a1a" }}
                    title="Elimina tag"
                    aria-label={`Elimina tag ${tag}`}
                  >×</button>
                </div>
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
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="nuovo tag"
                  className="flex-1 px-2 py-1 text-sm rounded border bg-white/70"
                  style={{ borderColor: "#e5dfd2", color: TOKENS.smoke }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addSidebarTag(e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    const input = e.currentTarget.previousElementSibling;
                    if (input && input.value) {
                      addSidebarTag(input.value);
                      input.value = '';
                    }
                  }}
                  className="px-3 py-1 rounded border text-sm"
                  style={{ borderColor: "#e5dfd2", background: "#fffaf1", color: TOKENS.smoke }}
                  title="Aggiungi tag"
                >+
                </button>
              </div>
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
                    <div key={tag} className="flex items-center gap-2">
                      <button
                        onClick={() => { setTagFilter(active ? "" : tag); setMenuOpen(false); }}
                        className={`flex-1 text-left px-3 py-2 rounded border text-sm ${active ? "font-semibold" : ""}`}
                        style={{ borderColor: "#e5dfd2", background: active ? TOKENS.mustard : "transparent", color: active ? "#fff" : TOKENS.smoke }}
                      >
                        #{tag}
                        <span className="float-right opacity-70">{count}</span>
                      </button>
                      <button
                        onClick={() => deleteSidebarTag(tag)}
                        className="w-8 h-8 rounded border grid place-items-center text-sm"
                        style={{ borderColor: "#e5dfd2", background: "#fffaf1", color: "#8b1a1a" }}
                        title="Elimina tag"
                        aria-label={`Elimina tag ${tag}`}
                      >×</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Context menu editor (duplicato rimosso: la versione corretta è dentro l'overlay espanso) */}

        {settingsOpen && (
          <div
            className="fixed inset-0 z-[2000]"
            onMouseDown={(e) => { if (e.target === e.currentTarget) setSettingsOpen(false); }}
          >
            <div className="absolute inset-0 bg-black/40" />
            <div
              className="absolute left-1/2 top-24 -translate-x-1/2 w-[min(740px,92vw)] max-h-[70vh] rounded-2xl border shadow-lg overflow-hidden"
              style={{ borderColor: '#e5dfd2', background: '#fffaf1' }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: '#e5dfd2' }}>
                <div className="font-semibold" style={{ color: TOKENS.ink }}>Impostazioni</div>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="w-8 h-8 grid place-items-center rounded border"
                  style={{ borderColor: '#e5dfd2', background: '#fff', color: TOKENS.smoke }}>×</button>
              </div>
              <div className="p-4 overflow-auto" style={{ maxHeight: '60vh' }}>
                {cfgLoading ? (
                  <div className="text-sm" style={{ color: TOKENS.smoke }}>Caricamento impostazioni…</div>
                ) : (
                  <>
                    {cfgError && (
                      <div className="mb-3 text-sm" style={{ color: '#8b1a1a' }}>Errore: {String(cfgError)}</div>
                    )}

                    <div className="mb-4">
                      <div className="text-xs uppercase tracking-wider mb-2" style={{ color: TOKENS.smoke }}>Tema</div>
                      <div className="flex items-center gap-2">
                        {['retro','dark','zen'].map(t => (
                          <button key={t}
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation();
                              const prev = theme;
                              setTheme(t);
                              updateConfigPart({ app: { theme: t } });
                              if (!useCustomPalette) {
                                const oldP = themeDefaultPalette(prev);
                                const newP = themeDefaultPalette(t);
                                // Mappa i colori delle note dal vecchio tema al nuovo (per indice)
                                setNotes(prevNotes => prevNotes.map(n => {
                                  const idx = oldP.indexOf(n.color);
                                  if (idx >= 0 && idx < newP.length) return { ...n, color: newP[idx] };
                                  return n;
                                }));
                                setPalette(newP);
                              }
                            }}
                            className={`px-3 py-1 rounded border text-sm ${theme === t ? 'font-semibold' : ''}`}
                            style={{ borderColor: '#e5dfd2', background: theme === t ? (THEMES[theme]?.mustard || '#d6a516') : '#fff', color: theme === t ? '#fff' : TOKENS.smoke }}
                          >{t.charAt(0).toUpperCase()+t.slice(1)}</button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="text-xs uppercase tracking-wider mb-2" style={{ color: TOKENS.smoke }}>Generale</div>
                      <div className="flex items-center justify-between gap-3 rounded border px-3 py-2"
                           style={{ borderColor: '#e5dfd2', background: '#fff' }}>
                        <div className="text-sm" style={{ color: TOKENS.ink }}>Modalità debug</div>
                        <button type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation();
                            const current = !!(appConfig && appConfig.app && appConfig.app.debug);
                            updateConfigPart({ app: { debug: !current } });
                          }}
                          className={`px-3 py-1 rounded border text-sm ${appConfig?.app?.debug ? 'font-semibold' : ''}`}
                          style={{ borderColor: '#e5dfd2', background: appConfig?.app?.debug ? TOKENS.mustard : '#fff', color: appConfig?.app?.debug ? '#fff' : TOKENS.smoke }}
                        >
                          {appConfig?.app?.debug ? 'ON' : 'OFF'}
                        </button>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="text-xs uppercase tracking-wider mb-2" style={{ color: TOKENS.smoke }}>Sistema</div>
                      <div className="rounded border px-3 py-2 text-sm flex items-center justify-between gap-3" style={{ borderColor: '#e5dfd2', background: '#fff' }}>
                        <div>
                          <div style={{ color: TOKENS.ink }}>Avvia all’avvio di Windows</div>
                          {!!autoStartError && (
                            <div className="text-xs mt-1" style={{ color: '#8b1a1a' }}>{autoStartError}</div>
                          )}
                        </div>
                        <button type="button"
                          disabled={autoStartBusy}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAutoStartEnabled(!(!!autoStart)); }}
                          className={`px-3 py-1 rounded border text-sm ${autoStart ? 'font-semibold' : ''}`}
                          style={{ borderColor: '#e5dfd2', background: autoStart ? TOKENS.mustard : '#fff', color: autoStart ? '#fff' : TOKENS.smoke, opacity: autoStartBusy ? 0.6 : 1 }}
                        >
                          {autoStart ? 'ON' : 'OFF'}
                        </button>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          className="px-3 py-1 rounded border text-sm"
                          style={{ borderColor: '#e5dfd2', background: '#fff', color: TOKENS.smoke }}
                          onClick={async (e)=>{ e.preventDefault(); e.stopPropagation(); try{ await waitForPywebviewApi(1000); const res = await window.pywebview.api.restore_last_backup(); if(!res?.ok){ alert('Nessun backup da ripristinare: '+(res?.error||'')); } else { alert('Backup ripristinato. Riavvia l\'app.'); } } catch(err){ alert('Errore ripristino: '+err); } }}
                        >Ripristina ultimo backup</button>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="text-xs uppercase tracking-wider mb-2" style={{ color: TOKENS.smoke }}>Palette schede</div>
                      <div className="rounded border p-3" style={{ borderColor: '#e5dfd2', background: '#fff' }}>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm" style={{ color: TOKENS.ink }}>
                            <input type="checkbox" className="mr-2"
                                   checked={useCustomPalette}
                                   onChange={(e) => {
                                     const on = e.currentTarget.checked;
                                     setUseCustomPalette(on);
                                     if (!on) setPalette(themeDefaultPalette(theme));
                                   }} />
                            Usa palette personalizzata
                          </label>
                          {!useCustomPalette && (
                            <button type="button" className="px-2 py-1 text-xs rounded border" style={{ borderColor: '#e5dfd2', color: TOKENS.smoke }} onClick={() => setPalette(themeDefaultPalette(theme))}>Reimposta</button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {palette.map(col => (
                            <button key={col} type="button" className="w-6 h-6 rounded-full border" style={{ background: col, borderColor: '#00000022' }}
                              onClick={(e) => e.preventDefault()}
                              onContextMenu={(e) => { e.preventDefault(); if (!useCustomPalette) return; setPalette(p => p.filter(c => c !== col)); }}
                              title={useCustomPalette ? 'Click destro per rimuovere' : 'Palette tema'}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="text" placeholder="#A1B2C3" className="w-28 px-2 py-1 text-xs rounded border bg-white/70"
                                 style={{ borderColor: '#e5dfd2', color: TOKENS.smoke }}
                                 disabled={!useCustomPalette}
                                 onKeyDown={(e) => {
                                   if (e.key === 'Enter' && useCustomPalette) {
                                     let s = String(e.currentTarget.value||'').trim();
                                     if (!s) return; if (s[0] !== '#') s = '#'+s; s = s.replace(/[^#0-9a-fA-F]/g,'');
                                     if (!/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(s)) return;
                                     if (!palette.includes(s)) setPalette(p => [...p, s]);
                                     e.currentTarget.value='';
                                   }
                                 }} />
                          <span className="text-xs" style={{ color: TOKENS.smoke }}>Invio per aggiungere</span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-2 text-xs" style={{ color: TOKENS.smoke }}>
                      Dati: {appConfig ? 'caricati' : 'default'} • Versione UI locale
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



