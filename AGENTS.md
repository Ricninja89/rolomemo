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

8) [ ] Test manuali post-build

Avvio: nessun “loading infinito”. Se succede, è quasi sempre un path asset non risolto.

Verifica: rotella, doppio click/espansione, overlay che copre il ring, z-index in primo piano, layout switch (Rolomemo/Grid), drawer mobile, salvataggio e ripristino note, seed onboarding alla prima apertura.

Riduzione finestra: ring centrato, overlay nota espansa contenuta in viewport, hamburger funziona.