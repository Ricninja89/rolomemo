RoloMemo — Desktop App (Offline)
================================

RoloMemo è un’app desktop (Windows/macOS/Linux) per prendere note in stile Rolodex vintage. UI in React, runtime offline via PyWebView: nessun accesso rete, asset locali.

Powered by https://digitalezen.it


Download Veloci
- Ultima release (portable ZIP): [Releases → Latest](https://github.com/Ricninja89/rolomemo/releases/latest)


Scaricare e Usare (Windows — Portable)
- Scarica da Releases il file `RoloMemo-Portable-vX.Y.Z.zip` e il relativo `.sha256.txt`.
- Tasto destro sullo ZIP → Proprietà → spunta “Sblocca” → Applica (rimuove il blocco SmartScreen).
- Estrai lo ZIP in una cartella (es. `C:\Programmi\RoloMemo` o `C:\Apps\RoloMemo`).
- Avvia `RoloMemo.exe`.

Salvataggi
- Dati utente: `%APPDATA%/rolomemo/`
  - `notes.json`, `config.json`, `backups/`, `app.log`
- Salvataggio automatico con debounce e “flush” su chiusura. Al riavvio, l’app carica la versione più recente tra file e localStorage.


Build da Sorgente (Windows)
Prerequisiti: Python 3.9+ (testato con 3.13), PowerShell.

1) Clona il repo e prepara ambiente
   - `python -m venv venv`
   - `./venv/Scripts/Activate.ps1`
   - `pip install -r requirements.txt`

2) Build One-Dir
   - `./venv/Scripts/python build_installer.py`

3) Avvia
   - `dist/RoloMemo/RoloMemo.exe`

Portable ZIP (build locale)
- PowerShell: `./venv/Scripts/python build_installer.py` (genera One-Dir `dist/RoloMemo/`)
- Crea ZIP: `Compress-Archive -Path dist/RoloMemo/* -DestinationPath dist/RoloMemo-Portable-vLOCAL.zip`


Linux/macOS (nota)
- Il progetto è offline‑first; per le build native servono runtime WebKit/GTK o WebView macOS. Le istruzioni attuali automatizzano Windows; pipeline per Linux/macOS può essere aggiunta in futuro.


Struttura
- `rolomemo.py` - app PyWebView; genera un HTML temporaneo e apre asset locali in `assets/`
- `rolomemo_component.js` - componente React iniettato in `<script type="text/babel">`
- `assets/` - React/ReactDOM UMD, Babel standalone, Tailwind frozen CSS
- `scripts/generate_index.py` - (opzionale) genera `dist/index.html` offline
- `build_installer.py` - PyInstaller One-Dir/One-File
- `scripts/release_win.ps1` - release script Windows (clean + build + verifica)


Troubleshooting
- Loading infinito: quasi sempre asset mancanti in `assets/` — usa `scripts/generate_index.py` e ricrea la build.
- Persistenza: controlla `%APPDATA%/rolomemo/notes.json` e `app.log`. All’uscita avviene un “flush” immediato.
- WebView2 mancante (Windows): installa Microsoft Edge WebView2 Runtime e riavvia l’app.


Contribuire
Vedi `CONTRIBUTING.md`. Apri una issue per bug/feature (template disponibili). Codice di condotta in `CODE_OF_CONDUCT.md`.


Licenza
MIT — vedi `LICENSE`.
