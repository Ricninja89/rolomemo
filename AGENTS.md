Checklist modifiche
1) [x] Struttura progetto / asset locali

Crea una cartella assets/ alla radice del progetto con dentro:

react.production.min.js (UMD)

react-dom.production.min.js (UMD)

babel-standalone.min.js oppure decidi di pre-compilare il componente (vedi punto 4)

tailwind.css (CSS già compilato con le utility che usi)

eventuale icon.ico (se vuoi l’icona dell’eseguibile)

Nota: per tailwind.css non usare la CDN. Genera un CSS “frozen” con una safelist delle utility effettivamente usate.

2) [x] rolomemo.py (caricamento offline + path PyInstaller)

Aggiungi una funzione resource_path che risolve i file quando l’app gira da PyInstaller (sys._MEIPASS) e quando gira da sorgente.

Fai puntare tutti gli script e gli stylesheet dell’HTML_TEMPLATE a file locali in assets/ (niente CDN).

Mantieni l’iniezione del contenuto di rolomemo_component.js nel placeholder prima della riga che fa il render.

Quando usi webview.create_window con html=..., scrivi l’HTML risultante in un file temporaneo (o usa dist/index.html) e aprilo con url=file://... (in modo che i path relativi a assets/ funzionino anche da eseguibile).

Se scegli di rimanere con html= in memoria, imposta il base_url/cartella di riferimento per risolvere i path relativi (oppure inlinerizza gli asset, ma peserà di più).

Verifica che la finestra parta con debug secondo config e che l’evento closed logghi correttamente (già ok).

3) [x] rolomemo_component.js (compatibilità offline)

Assicurati che non ci siano export/import: il componente deve definire globalmente function RoloMemo() (com’è ora).

Mantieni l’uso di window.pywebview.api per load/save; fallback a localStorage già presente (ok).

Evita riferimenti esterni (font, immagini web, ecc.). Solo emoji e CSS locali.

4) [x] Scelta: Babel runtime vs prebuild

Scegli UNO dei due approcci (entrambi offline):

A. Runtime Babel (più semplice)

In HTML_TEMPLATE includi babel-standalone.min.js da assets/.

Mantieni <script type="text/babel"> con dentro il tuo componente iniettato.

B. Pre-build del componente (più leggero a runtime)

Pre-compila rolomemo_component.js in JS plain (IIFE/UMD) e salvalo in assets/app.bundle.js.

In HTML_TEMPLATE rimuovi Babel e includi solo React/ReactDOM + app.bundle.js.

Aggiorna il bootstrap finale: il bundle deve esporre RoloMemo in global prima di root.render(...).

(Se non vuoi introdurre uno step di build JS adesso, resta su A.)

5) [x] build_installer.py (packaging asset)

Aggiungi tutta la cartella assets/ agli --add-data.

Assicurati che venga aggiunto anche rolomemo_component.js (serve se usi l’iniezione runtime).

(Opzionale) se generi un dist/index.html, includilo negli --add-data e fai aprire quello.

Mantieni --windowed e --onefile. Usa il separatore corretto ; su Windows, : su macOS/Linux.

Stampa chiara del percorso output e check dell’eseguibile creato (già presente).

6) [x] requirements*.txt

pywebview pin compatibile (Windows/macOS/Linux). Su Linux nota che può servire la extra [gtk].

Non aggiungere dipendenze JS: React/Babel/Tailwind sono file statici in assets/.

pyinstaller resta solo in requirements-dev.txt (dev-only).

7) [x] Offline “vero”

Verifica che nessun link in HTML punti a https://… (React, ReactDOM, Babel, Tailwind: tutti locali).

Niente font remoti: usa default di sistema.

Testa disconnesso: l’app deve aprirsi e salvare note in %APPDATA%/rolomemo/notes.json.

IMPLEMENTAZIONI

1) Aggiungi nella colonna dei tag la possibilità di aggiungere nuovi tag e di eliminare quelli esistenti

2) Aggiungi nella header un icona per aprire una sezione "impostazioni"

3) Impostazioni apre una finestra popup contenente le impostazioni del programma

4) Aggiungi nel menù impostazioni la possibilità di abilitare "avvia all'avvio di winows"

5) Nelle impostazioni aggiungi la possibilità di selezionare un tema per l'app. Ogni Tema comprende modifiche sia alla paletta di colori per le card che agli altri colori del programma. 

6) In impostazioni i temi selezionabili saranno 3: 1. Tema Retrò (quello attuale di base) 2. Tema dark  3. Tema Zen (colori chiari e rilassanti)

7) Aggiungi in Impostazioni la possibilità di creare una paletta di colori per le card personalizzata scegliendo tra una buona varietà di colori predefiniti o di aggiungere i propri tramite codice colore

8) All'interno della card espansa accanto ai colori, l'icona per aggiungere un colore viene sostituita con un icona che rimanda alle palette personalizzate in impostazioni

9) All'interno della card espansa la possibilità di rimuovere i tag già asseegnati.

10) Dentro la card espansa abilitare la possibilità di usare il click destro del mouse per le operazioni classiche (copia, incolla, seleziona tutto, ecc)

11) Dentro la card espansa implementare funzionalità da editor di testo: icone base per testo corsivo, grassetto, sottolineato, elenco, che si applicano al testo selezionato. Inoltre la card espansa deve accettare comandi da tastiera (ctrl + B per trasformare in grassetto un testo selezionato, ecc)

12) l'editor testuale della card espansa deve riconoscere il formato md, per formattazioni rapide. 

13) l'editor testuale della card espansa riconoscera il carattere "-" per iniziare un elenco puntato, così come riconoscerà "--" per l'elenco puntato nidificato. Inoltre da un elenco puntato usando il tasto tab si passerà all'elenco nidificato e viceversa con MAIUSC+TAB.


PROSSIME IMPLEMENTAZIONI (Roadmap)

1) Esportazione/Importazione backup JSON delle note

- Backend (Python)
  - Aggiungere in `DataManager` metodi: `export_notes(path: Path)` e `import_notes(path: Path)`.
    - `export_notes`: legge `NOTES_FILE`, valida lo schema base (`notes` array, `updatedAt` int opzionale), salva su `path` con indentazione 2 e UTF‑8.
    - `import_notes`: legge il file scelto, valida schema e coerenza; se valido: crea backup prima di sovrascrivere, applica salvaguardie esistenti (anti-azzeramento, timestamp), poi salva.
  - Esporre API in `RoloMemoAPI`: `export_notes_dialog()` (Save As) e `import_notes_dialog()` (Open File) usando `webview.windows[0].create_file_dialog`.
  - Logging chiaro su esiti, numero note importate/esportate, e percorso file.
- Frontend (JS/React)
  - In “Impostazioni” aggiungere sezione “Backup”: pulsanti “Esporta backup (.json)” e “Importa backup (.json)”.
  - Conferme utente: su import chiedere conferma e mostrare riepilogo; su esito mostrare toast/snag.
  - Validazioni UI: accettare solo `.json`; mostrare errori leggibili in caso di schema non valido.
- Formato file
  - JSON identico al payload interno: `{ notes: [...], updatedAt: <epoch_ms>, ... }`.
  - Estensione consigliata: `.rolomemo.json` (opzionale) per distinguere da altri JSON.
- Risorse esterne
  - Nessuna obbligatoria. (Opzionale: `jsonschema` per validazione, ma evitabile con validazioni manuali.)

2) Anteprima note “ben formattata” (Markdown safe in lista)

- Obiettivo
  - Nelle card/anteprime mostrare testo renderizzato (bold/italic/code/list/heading minimi), non HTML grezzo. Sicuro (no XSS) e leggero.
- Implementazione
  - Aggiungere util `renderPreview(text: string): { __html: string }` che converte un sottoinsieme Markdown → HTML e sanifica output.
  - Applicare la preview alla lista note (solo prime N righe/ caratteri). Gestire clamp e bullet con CSS locali.
  - Prestazioni: memoizzare per `id`+`updatedAt`; evitare render costosi su ogni keystroke.
- Opzioni parsing
  - Zero dipendenze: micro-parser interno per subset (###, **bold**, *italic*, `code`, liste con “-”/“--” → ul/li nidificate). Sanitizzazione con allowlist di tag (`p, b, strong, i, em, code, ul, li, br`).
  - Oppure asset locali: includere in `assets/` versioni minificate offline di `marked.min.js` e `dompurify.min.js` e usarle senza CDN. Packaging via `--add-data`.
- Risorse esterne
  - Nessuna obbligatoria. (Se si usa parser esterno: file statici JS in `assets/`, nessuna rete a runtime.)

3) Integrazione Google Drive + sincronizzazione account Google

- Flusso e scopo
  - Sincronizzare `notes.json` su Google Drive (cartella app o `appDataFolder`). Login con OAuth 2.0, sync manuale e/o automatico (pull all’avvio, push su salvataggio con backoff).
- Backend (Python)
  - Dipendenze opzionali: `google-auth`, `google-auth-oauthlib`, `google-api-python-client` (aggiunte in `requirements-optional.txt` o extra). Usare import lazy e fallback per mantenere offline by default.
  - Credenziali: file `client_secret.json` o variabili env; salvare token/refresh token in `DATA_DIR/credentials/google_token.json` (permessi 600). Scope consigliato: `https://www.googleapis.com/auth/drive.file` o `appDataFolder`.
  - API in `RoloMemoAPI`: `google_sign_in()`, `google_sign_out()`, `google_status()`, `google_upload_backup()`, `google_download_latest()`, `google_list_backups()`.
  - Storage remoto: usare `appDataFolder` con un singolo `notes.json` versione più recente; gestire `modifiedTime`, `md5Checksum`, e conflitti via `updatedAt` locale; creare anche backup incrementali opzionali.
  - Robustezza: retry esponenziale, gestione offline (queue), timeout ragionevoli; log dettagliati.
- Frontend (JS/React)
  - In “Impostazioni” aggiungere sezione “Google Drive”: pulsanti Connetti/Disconnetti, “Sincronizza ora”, stato (ultima sync, utente), toggle “Sync automatica”.
  - Messaggistica UI su errori (es. credenziali mancanti, rete assente).
- Risorse esterne
  - Account Google Cloud, progetto e OAuth consent screen approvato.
  - Librerie Python: `google-auth`, `google-auth-oauthlib`, `google-api-python-client` (opzionali).

4) Integrazione Todoist

- Flusso e scopo
  - Collegare note ↔ attività Todoist. Minimo: esportare note selezionate come task in un progetto “RoloMemo”, importare task come note bozze, con etichette ↔ tag.
- Backend (Python)
  - API REST Todoist v2: `https://api.todoist.com/rest/v2/`.
  - Autenticazione: inizialmente API Token personale (campo in Impostazioni), poi OAuth 2.0. Salvare token in `config.json` (criptazione opzionale).
  - Dipendenze: `requests` (o `urllib` stdlib se si vuole evitare dipendenze). Rate-limit e retry con backoff.
  - Mapping: definire tabella `todoist_map.json` (DATA_DIR) per associare `note_id ↔ task_id`; campi: titolo→content, tag→labels, priorità da colore/tema (opzionale).
  - API `RoloMemoAPI`: `todoist_test_connection()`, `todoist_push_selected(note_ids)`, `todoist_pull(project_id?, label?)`, `todoist_sync()`.
- Frontend (JS/React)
  - Sezione “Todoist” in Impostazioni: campo token, scelta progetto, direzione sync, “Sync ora”.
  - Opzioni: “Crea attività solo da note con tag @todo”, “Aggiorna stato completato → archivia nota”.
- Risorse esterne
  - Account Todoist, API Token o OAuth client.
  - Libreria `requests` (opzionale se si usa stdlib), accesso rete.

Note generali

- Packaging: includere eventuali asset JS aggiuntivi in `assets/` e aggiornarne l’inclusione in `build_installer.py`/`setup.py` con `--add-data`.
- Config: aggiungere chiavi in `DEFAULT_CONFIG.app` con fallback sicuri (e.g. `integrations: { google: {...}, todoist: {...} }`).
- Sicurezza: non committare credenziali; salvare token in `DATA_DIR/credentials/`; proteggere con permessi file.
- Offline-first: tutte le integrazioni devono essere opzionali, disattivate per default, e non rompere l’avvio offline.


NoteApp PC — Roadmap Milestones (MVP → M4)

Obiettivo: consegnare una note‑app gratuita per PC, semplice, affidabile, portabile e senza lock‑in. Roadmap pragmatica, pronta da passare a dev.

M0 — MVP “Prendi nota e basta” (4–6 settimane)

Scope

- UI minimale e veloce: finestra unica, latenza input < 50 ms, avvio < 1s su HW medio.
- Storage locale: una nota = 1 file .md in una cartella utente; indice JSON per ricerca.
- Offline‑first: nessuna dipendenza da cloud o login.
- Formattazione base: titoli, grassetto, corsivo, elenchi, checklist ✅
- Organizzazione: cartelle + tag (tag salvati nel front‑matter YAML).
- Ricerca: full‑text (titolo, corpo, tag), filtri per cartella/tag.
- Import/Export: MD/TXT/HTML/PDF (singola nota o batch).
- Sicurezza dati: autosave, versioning locale (snapshot per nota), backup giornaliero della cartella.
- Installazione Windows: installer offline, auto‑update disattivabile.

Out of scope: sync, allegati pesanti, collaborazione, AI, web clipper.

Acceptance Criteria

- Crea/edita 10k note senza lag percepibile (ricerca < 150 ms, scorri lista fluido).
- Uccisione processo o blackout ≠ perdita contenuto (ultimo autosave max 10s).
- Export “Tutte le note” in zip (MD + media + indice JSON).
- Disinstallazione non lascia dati orfani oltre alla cartella dell’utente.

Tech Notes

- File system watching per indice; search con indice incrementale.
- Front‑matter YAML: `title`, `tags`, `created`, `updated`, `uuid`.

M1 — Sync & Portabilità (3–5 settimane)

Scope

- Sync opzionale (opt‑in): provider a scelta (cartella locale/SMB, WebDAV, Dropbox/Drive via SDK o “sync directory”).
- Risoluzione conflitti: per‑nota, mostra diff, scegli versione o merge testuale.
- Export/Migrazione: wizard “migra da/verso” (cartella, ZIP), operazione reversibile.
- Cifratura locale: vault opzionale (password/chiave) per specifiche cartelle di note.

Acceptance Criteria

- Sync > 5k note, conflitti visibili e risolvibili in < 3 click.
- Export full con restore integrale su nuovo PC (path indipendente).

Tech Notes

- Strategia CRDT semplificata oppure last‑writer‑wins con diff assistito.
- Cifratura: scrypt + AES‑GCM (solo a riposo), chiavi non inviate esternamente.

M2 — Potenziamenti di scrittura (3–4 settimane)

Scope

- Backlink/wiki links: `titolo-o-uuid` con pannello “collegamenti entranti”.
- Allegati/Immagini: cartella `media/` per nota, drag&drop inline.
- Reminder leggeri: per nota (notifiche locali OS), snooze.
- Template: note giornaliere, meeting, to‑do settimanale (MD con variabili).

Acceptance Criteria

- Crei link tra note senza rompere export (link risolti via UUID in MD).
- Allegati inclusi nell’export ZIP e ri‑mappati al restore.

Tech Notes

- Mappa titolo⇄UUID per link robusti; pannello graf opzionale in backlog.

M3 — Performance & Scalabilità (2–3 settimane)

Scope

- Budget prestazioni: avvio < 700 ms (10k note), ricerca < 120 ms; RAM target < 300 MB in idle.
- Ottimizzazioni: virtualizzazione lista note, indicizzazione differita, thumbnail async.
- QA carico: dataset sintetico 50k note/5 GB allegati.

Acceptance Criteria

- Benchmark pubblici con dati e hardware di riferimento.
- Nessun frame drop visibile nello scrolling lista note (60fps target).

M4 — Inking (opzionale per 2‑in‑1) (3–5 settimane)

Scope

- Penna: input a mano libera su canvas paginated (A4, Letter, infinito opzionale).
- Export PDF fedele (no tagli, no sforamento margini), palm rejection.
- Layer: inchiostro come layer accanto al testo; OCR in backlog.

Acceptance Criteria

- Scrittura fluida a 120 Hz su device compatibili; PDF identico alla pagina.

Guardrail (MUST‑NOT‑HAVE)

- Niente freemium aggressivo: nessuna funzione base dietro paywall (ricerca, export, multi‑cartelle, dark mode).
- Zero lock‑in: formati aperti, export completo sempre disponibile.
- No cloud‑only: l’app funziona interamente offline; sync è opzionale.
- No UI caotica: niente ribbon sovraccarichi, niente wizard infiniti.
- No lentezze: niente app electron‑matrioska senza profiling; performance budget obbligatorio.
- No feature‑bloat: niente AI, collaborazione realtime o progetti che snaturano l’app prima di M3.
- No tracking per default: telemetria disattiva; opt‑in granulari.
- No canvas infinito obbligatorio: se presente, alternativa a pagina fissa.

Definition of Done (per milestone)

- Requisiti soddisfatti + test automatici (unit, integrazione) su CI.
- Pacchetto installer firmato + rollback sicuro.
- Manuale utente breve in‑app (F1) + changelog.
- Suite QA su: blackout, conflitti, dataset grande, percorsi non ASCII.

Backlog/Nice‑to‑Have

- Plugin API limitata (render hook, esportatori custom).
- Web clipper leggero (salva pagina→MD+snapshot).
- Vista grafo collegamenti, temi personalizzati.
- App companion mobile in sola lettura + sync read‑only.

Note per Dev

- Struttura repo: `core/` (engine), `ui/` (shell), `sync/` (provider), `export/`.
- Feature flag per M1/M2/M4; toggle runtime per debug prestazioni.
- File watcher cross‑platform; attento a path lunghi e permessi.

Messaggio chiave: semplice, veloce, affidabile, esportabile. Tutto il resto dopo.

CHECKLIST DETTAGLIATE PER MILESTONE (Actionable)

Nota: ogni voce include sottopunti per grafica coerente/migliorata, dipendenze, test/build, documentazione. Le checklist sono vincolanti per PR e release.

M0 — MVP “Prendi nota e basta” — Checklist

- UI minimale e veloce
  - Coerenza grafica: usare token colore/spacing tipografici condivisi; niente font remoti; test dark/light se presenti.
  - Performance: misurare latenza input (<50 ms) e tempo avvio (<1s) su HW medio; profilare render; evitare reflow costosi; virtualizzare liste > 1k elementi.
  - A11y: focus visibile, scorciatoie tastiera base, contrasti AA.
  - Test: snapshot UI principali; smoke test su 3 risoluzioni; nessun warning console.
  - Build: asset locali in `assets/`; nessuna CDN; verifica caricamento offline.

- Storage locale (MD per nota + indice JSON)
  - Formato file: Markdown con front‑matter YAML (`title`, `tags`, `created`, `updated`, `uuid`).
  - Scrittura sicura: write‑to‑temp + atomic rename; encoding UTF‑8; gestione path lunghi/char non ASCII.
  - Indice: JSON incrementale; file watcher per aggiornare index su modifiche; debounce e dedup; persistenza in `%APPDATA%/rolomemo/`.
  - Test: CRUD 10k file; rename/move; crash test durante write (nessuna corruzione). Verifica consistenza index.
  - Dipendenze: nessuna obbligatoria (stdlib); opzionale `watchdog` per FS watching (fallback a polling).

- Offline‑first
  - Nessun requisito di rete per avvio/uso base; tutte le call di rete opzionali dietro flag.
  - Modalità degradata: messaggi chiari se funzionalità online non disponibili.
  - Test: disconnesso, modalità aereo; nessun errore in console/log.

- Formattazione base (titoli, bold, italic, liste, checklist)
  - Toolbar minimale + scorciatoie (Ctrl+B/I/U, liste, checklist). Parser MD sicuro; sanificazione output con allowlist.
  - Coerenza grafica: stile heading, liste e checklist coerenti con tema.
  - Test: casi MD complessi (nidificate, code span, escaping); round‑trip edit/preview.
  - Dipendenze: micro‑parser interno oppure `marked.min.js` + `dompurify.min.js` come asset locali.

- Organizzazione (cartelle + tag)
  - Cartelle: creazione/rename/move con impatto su index; selezione cartella corrente; breadcrumb.
  - Tag: salvati in front‑matter; suggerimenti autocompletamento; merge/rename tag; rimozione da nota.
  - Test: operazioni batch su 1k note; rename cartella/tag con propagazione.

- Ricerca
  - Indice full‑text: titolo, corpo, tag; filtri per cartella/tag; ranking semplice; highlighting in preview.
  - Performance: query <150 ms su 10k note; indicizzazione incrementale; caching query recenti.
  - Test: accuratezza risultati, stemming/sensibilità caso; edge cases (simboli, unicode).

- Import/Export (MD/TXT/HTML/PDF)
  - Import: parser MD/TXT; mappa front‑matter; assegna UUID; collocazione cartella; report import.
  - Export singola/batch: MD lossless; HTML sanificato; PDF fedele (opz. `wkhtmltopdf` o print‑to‑PDF OS). ZIP “Tutte le note” (MD + media + index.json).
  - UI: wizard semplice; stato/progresso; gestione errori per file problematici.
  - Test: batch 5k note; caratteri speciali; immagini; confronto hash contenuti.
  - Dipendenze: nessuna obbligatoria; opzionale tool PDF esterno documentato.

- Sicurezza dati (autosave, versioning per nota, backup giornaliero)
  - Autosave: intervallo configurabile (default 10s); indicatore stato; throttle su idle.
  - Versioning: snapshot per nota in `.versions/` con diffs o full copy + dedup; purge policy.
  - Backup: giornaliero cartella note in ZIP; retention configurabile; pulsante restore.
  - Test: kill process durante edit → ripristino; restore snapshot/backup.

- Installazione Windows (installer offline, auto‑update disattivabile)
  - Builder: PyInstaller onefile + Inno Setup; icone e metadata; percorsi Program Files + `%APPDATA%` per dati.
  - Firma: Authenticode EXE e setup; timestamp server; Publisher coerente.
  - Auto‑update: disattivabile; se presente, canale stabile e controllo firma (post‑M0 opzionale).
  - CI: workflow Windows (build, sign, package, release artifact).
  - Test: installazione/aggiornamento/disinstallazione; UAC; SmartScreen; antivirus comuni.

- Validazione M0
  - Benchmark: avvio <1s; ricerca <150 ms; editing fluido su 10k note.
  - Robustezza: blackout/kill non causano perdita >10s di lavoro.
  - Export globale ZIP; disinstallazione pulita (niente residui oltre cartella utente).
  - Documentazione: guida rapida in‑app (F1) + README + changelog.

M1 — Sync & Portabilità — Checklist

- Architettura sync (opt‑in)
  - Interfaccia `SyncProvider` con metodi `pull/push/list/conflicts/resolve`.
  - Provider iniziali: `LocalFolder/SMB` e `WebDAV`; Google/Dropbox via “sync directory” o SDK opzionale.
  - Conflitti: modello last‑writer‑wins con diff assistito; UI di confronto; merge testuale opzionale.
  - Coda operazioni e retry con backoff; journaling.
  - Test: 5k note, modifiche concorrenti su due macchine; conflitti visibili e risolti <3 click.

- Wizard Export/Migrazione
  - Selettori origine/destinazione (cartella/ZIP); anteprima conteggio file; dry‑run.
  - Operazione reversibile con checkpoint; log dettagliati.
  - Test: migrazione avanti/indietro su dataset grande.

- Cifratura locale (vault opzionale)
  - Design: scrypt (KDF) + AES‑GCM; salt univoco; file `.keymeta`; esclusione dall’indice se cifrati.
  - UI: crea/attiva/disattiva vault; cambio password; sblocco sessione.
  - Test: corruzione intenzionale file cifrato → errori chiari; prestazioni accettabili.
  - Dipendenze: `cryptography` (opzionale, extra); fallback disabilitato senza extra.

- Validazione M1
  - Sync stabile con interruzioni di rete; ripresa consistente.
  - Export/restore su nuovo PC con path indipendente.
  - Doc: guida “Come sincronizzare” + avvertenze privacy.

M2 — Potenziamenti di scrittura — Checklist

- Backlink / Wiki links
  - Parser `[[titolo-o-uuid]]`; risoluzione a UUID; aggiornamento su rename; indice collegamenti entranti.
  - UI pannello backlink; navigazione rapida; anteprima hover.
  - Test: rename/merge note; link rotti; loop.

- Allegati/Immagini
  - Cartella `media/` per nota; drag&drop; rename sicuro; riferimenti relativi.
  - UI: placeholder, thumbnail async; compressione opzionale.
  - Export: includere media e rimappare al restore.
  - Test: file grandi, nomi unicode, duplicati.

- Reminder leggeri
  - API notifiche locali OS; snooze; persist in front‑matter.
  - Test: persist/restore reminder; time‑zones; sleep/resume.
  - Dipendenze: `winrt`/`plyer` opzionali, con fallback.

- Template
  - Galleria template MD con variabili; inserimento rapido; data/ora; contatori.
  - Test: placeholder non risolti; aggiornamento template.

- Validazione M2
  - Scrittura fluida; nessuna regressione performance; doc “Scrivere meglio”.

M3 — Performance & Scalabilità — Checklist

- Benchmarking e strumenti
  - Generatore dataset sintetico (50k note/5 GB media); script benchmark ripetibili.
  - Metriche: tempo avvio, memoria idle, latenza ricerca, FPS scroll.

- Ottimizzazioni
  - Virtualizzazione lista; indicizzazione differita; cache su disco; batching IO; lazy‑load media.
  - Profiling CPU/mem (campioni) e flamegraph; eliminare hot‑spots >5%.

- QA carico
  - Esecuzione benchmark su CI nightly; pubblicare report.
  - Test: nessun frame‑drop visibile (target 60fps). RAM idle < 300 MB.

- Validazione M3
  - Budget rispettati; report pubblico nel repo.

M4 — Inking — Checklist

- Engine inchiostro
  - Canvas paginato (A4/Letter/Infinito opz.); sampling penna 120 Hz (se supportato); smoothing.
  - Layer separati: testo ↔ inchiostro; salvataggio formato vettoriale (JSON/Protobuf) + raster cache.
  - Palm rejection (se backend supporta); gomma/undo/redo.

- Export PDF
  - Rendering pagina fedele; no tagli/sforamenti; margini configurabili.
  - Test: print‑to‑PDF vs export; identicità visiva.

- Integrazione con note
  - Collegare pagine inchiostro a note; anteprima thumbnail; gestione spazio.
  - Test: apertura/chiusura rapida; memoria entro budget.

- Validazione M4
  - Scrittura fluida; export identico; doc “Inking”.

Guardrail — Checklist di conformità (per ogni PR/Release)

- Nessun lock‑in: export completo disponibile e testato.
- Offline‑first rispettato: nessuna rete obbligatoria.
- Performance budget rispettato; benchmark aggiornati.
- UI coerente, nessun asset remoto; a11y minimo passato.
- Tracking disattivo; nessuna telemetria non documentata.
- Nessuna funzione base dietro paywall.

Release Checklist (generale)

- Test automatici verdi (unit/integration/e2e se presenti) + smoke test manuali.
- Build installer firmato, verifica firma e SmartScreen.
- Migrazioni dati verificate (se cambiano formati/percorsi).
- Documentazione aggiornata (README, guida in‑app, changelog).
- Asset offline completi in `assets/`; nessun riferimento a CDN.

5) Distribuzione Windows: installabile firmato + pipeline GitHub Actions

- Obiettivo
  - Passare da ZIP portabile a un installatore Windows tradizionale, firmato, per ridurre blocchi SmartScreen e semplificare l’installazione.
- Scelta tecnologia installer
  - Preferito: Inno Setup (`.iss`), leggero e flessibile. Alternative: NSIS, MSI/MSIX (valutazione futura).
- Build locale
  - PyInstaller: generare eseguibile `--windowed --onefile` (già presente) e produrre output in `dist/`.
  - Script Inno Setup: creare `installer/rolomemo.iss` con:
    - AppId, AppName, AppVersion, Publisher coerenti.
    - File: includere exe PyInstaller, `assets/`, eventuali file statici aggiuntivi.
    - Icona app (se disponibile), scorciatoie Desktop/Start.
    - Dir di dati utente lasciata in `%APPDATA%/rolomemo` (non installare dati in Program Files).
- Firma codice (Authenticode)
  - Requisiti: certificato Code Signing (meglio EV) + password; timestamp server (es. `http://timestamp.sectigo.com` o `http://timestamp.digicert.com`).
  - Strumenti: `signtool.exe` (Windows SDK) o `osslsigncode` come fallback.
  - Firmare sia l’eseguibile PyInstaller sia il setup Inno:
    - `signtool sign /fd SHA256 /tr <timestamp_url> /td SHA256 /f cert.pfx /p %CERT_PASS% <file>`
  - Benefici: riduzione avvisi SmartScreen e reputazione Publisher.
- Metadati e compatibilità SmartScreen
  - Mantenere Publisher e ProductName costanti; embed manifest (asInvoker), icona e versione coerente.
  - Evitare distribuzione ZIP: preferire EXE installabile firmato per non ereditare il Mark-of-the-Web sui contenuti estratti.
- GitHub Actions: build e rilascio
  - Runner: `windows-latest`.
  - Step:
    - Setup Python e cache pip.
    - Installare dipendenze (prod + dev: PyInstaller).
    - Build PyInstaller (onefile, windowed).
    - Installare Inno Setup (`choco install innosetup`) e compilare `.iss` (comando `iscc`).
    - Firma: ricreare `cert.pfx` da secret base64 (`WINDOWS_CERT_PFX_BASE64`) e password (`WINDOWS_CERT_PASSWORD`); usare `signtool` per firmare exe e setup; timestamp.
    - Upload artifact e pubblicazione nella Release (es. `softprops/action-gh-release`).
  - Secrets richiesti:
    - `WINDOWS_CERT_PFX_BASE64` (PFX codificato base64)
    - `WINDOWS_CERT_PASSWORD`
  - Output desiderati:
    - `RoloMemo-Setup-v{version}.exe` firmato, allegato alla release.
- Documentazione
  - Aggiornare README con istruzioni di installazione e verifica firma digitale.
  - Nota sulla telemetria: nessuna; app resta offline-first.
