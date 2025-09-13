RoloMemo — Desktop App (Offline)
================================

RoloMemo è un’app desktop (Windows/macOS/Linux) per prendere note in stile Rolodex vintage. UI in React, runtime offline via PyWebView: nessun accesso rete, asset locali.

Powered by https://digitalezen.it


Download Veloci
- Ultima release (zip pronto): [Releases → Latest](https://github.com/Ricninja89/rolomemo/releases/latest)
- Artifact CI (zip da Actions): [Actions → Windows Build](https://github.com/Ricninja89/rolomemo/actions/workflows/windows-build.yml)


Scaricare e Usare (Windows)
- Vai nella sezione “Actions” o “Releases” del repository GitHub e scarica lo zip generato dal workflow:
  - One‑Dir: contiene `RoloMemo.exe` più cartelle di supporto (consigliato)
  - One‑File (se presente): un unico `RoloMemo.exe` portabile
- Scompatta lo zip e avvia `RoloMemo.exe`.

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

One-File (opzionale)
- PowerShell: `$env:ROLOMEMO_ONEFILE='1' ; ./venv/Scripts/python build_installer.py`
- Output: `dist/RoloMemo.exe`


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
