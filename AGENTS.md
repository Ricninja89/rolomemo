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

