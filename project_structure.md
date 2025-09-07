# RoloMemo - Desktop App

Applicazione desktop per la gestione di note in stile Rolodex vintage, con estetica anni '60 e interazioni immersive.

## Struttura del Progetto

```
rolomemo/
├── rolomemo.py                 # App principale PyWebView
├── rolomemo_component.js       # Componente React (da copiare dall'artifact)
├── setup.py                   # Script di installazione
├── build_installer.py         # Script per creare eseguibili
├── requirements.txt           # Dipendenze Python
├── requirements-dev.txt       # Dipendenze sviluppo
├── README.md                  # Questo file
├── assets/
│   └── icon.ico              # Icona dell'app (opzionale)
├── tests/
│   └── test_app.py           # Test automatici
└── dist/                     # Directory output build
```

## Installazione Rapida

### 1. Preparazione Ambiente

```bash
# Clona o scarica il progetto
# cd nella directory del progetto

# Crea ambiente virtuale (raccomandato)
python -m venv venv
source venv/bin/activate  # Linux/Mac
# oppure: venv\Scripts\activate  # Windows
```

### 2. Installa Dipendenze

```bash
# Dipendenze base
pip install -r requirements.txt

# Per sviluppo (opzionale)
pip install -r requirements-dev.txt
```

### 3. Avvio Diretto

```bash
python rolomemo.py
```

## Build per Distribuzione

### Eseguibile Singolo (Raccomandato)

```bash
# Installa PyInstaller se necessario
pip install pyinstaller

# Crea eseguibile
python build_installer.py
```

L'eseguibile sarà disponibile in `dist/RoloMemo.exe` (Windows) o `dist/RoloMemo` (Linux/Mac).

### Pacchetto Portable

```bash
# Crea pacchetto portable (include sorgenti + script avvio)
python build_installer.py --portable
```

## File di Configurazione

L'app crea automaticamente:

- **Windows**: `%APPDATA%/rolomemo/`
- **macOS**: `~/Library/Application Support/rolomemo/`  
- **Linux**: `~/.local/share/rolomemo/`

File generati:
- `notes.json` - Dati delle note
- `config.json` - Configurazioni app
- `app.log` - Log applicazione
- `backups/` - Backup automatici note

## Caratteristiche

- **Interfaccia Rolodex 3D** - Navigazione rotativa tipo schedario
- **Audio Meccanico** - Suoni realistici di click
- **Salvataggio Automatico** - Backup incrementali
- **Filtri Tag** - Organizzazione per categorie
- **Tema Vintage** - Palette colori anni '60
- **Cross-platform** - Windows, macOS, Linux

## Sviluppo

### Test

```bash
python -m pytest tests/
```

### Formattazione Codice

```bash
black .
flake8 .
```

### Debug Mode

```bash
# Avvia con debug attivo
python rolomemo.py --debug
```

## Dipendenze Dettagliate

### Python
- `pywebview>=4.0.0` - Wrapper WebView
- Per Linux: `PyGObject` (installato automaticamente se necessario)

### Frontend (incluso via CDN)
- React 18
- Tailwind CSS
- Babel (transpilazione runtime)

## Troubleshooting

### Linux: Errore GTK
```bash
# Ubuntu/Debian
sudo apt install python3-gi python3-gi-cairo gir1.2-webkit2-4.0

# Fedora
sudo dnf install python3-gobject python3-gobject-devel webkit2gtk3-devel
```

### Windows: WebView2 non trovato
- Scarica Microsoft Edge WebView2 Runtime

### macOS: Permessi app
```bash
xattr -dr com.apple.quarantine RoloMemo.app
```

## API Interna

Il componente React comunica con Python tramite:

```javascript
// Carica dati
const data = await window.pywebview.api.load();

// Salva dati  
await window.pywebview.api.save(payload);

// Info app
const info = await window.pywebview.api.get_app_info();
```

## Personalizzazione

Modifica `CONFIG` in `rolomemo_component.js` per cambiare:
- Geometria 3D (raggi, angoli, profondità)
- Colori e palette
- Effetti audio
- Animazioni

## Licenza

MIT License - Vedi file LICENSE per dettagli

---

*RoloMemo v1.0.0 - Stile vintage per note moderne*