#!/usr/bin/env python3
"""
RoloMemo Desktop App
===================
Wrapper desktop per RoloMemo usando PyWebView
Gestisce il salvataggio dei dati localmente e l'interfaccia desktop
"""

import os
import sys
import json
import logging
import tempfile
import shutil
from pathlib import Path
from typing import Dict, Any, Optional

try:
    import webview
except ImportError:
    print("❌ PyWebView non installato. Installa con: pip install pywebview[gtk]")
    sys.exit(1)

from pathlib import Path  # se non c'è già

BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = BASE_DIR / "dist"
INDEX_HTML = DIST_DIR / "index.html"

# ========== CONFIGURAZIONE ==========

APP_NAME = "RoloMemo"
APP_VERSION = "1.0.0"
DATA_DIR_NAME = "rolomemo"

# Determina la directory dati dell'utente
if os.name == 'nt':  # Windows
    DATA_BASE = Path(os.environ.get('APPDATA', ''))
elif sys.platform == 'darwin':  # macOS
    DATA_BASE = Path.home() / 'Library' / 'Application Support'
else:  # Linux/Unix
    DATA_BASE = Path.home() / '.local' / 'share'

DATA_DIR = DATA_BASE / DATA_DIR_NAME
CONFIG_FILE = DATA_DIR / "config.json"
NOTES_FILE = DATA_DIR / "notes.json"
LOG_FILE = DATA_DIR / "app.log"

# Configurazione di default
DEFAULT_CONFIG = {
    "window": {
        "title": f"{APP_NAME} v{APP_VERSION}",
        "width": 1200,
        "height": 800,
        "min_width": 800,
        "min_height": 600,
        "resizable": True,
        "fullscreen": False,
        "minimizable": True,
        "on_top": False
    },
    "app": {
        "debug": False,
        "auto_save": True,
        "backup_count": 5,
        "theme": "light"
    }
}

# ========== LOGGING SETUP ==========

def setup_logging():
    """Configura il sistema di logging"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(LOG_FILE, encoding='utf-8'),
            logging.StreamHandler(sys.stdout)
        ]
    )
    return logging.getLogger(__name__)

logger = setup_logging()

# ========== GESTIONE DATI ==========

class DataManager:
    """Gestisce il salvataggio e caricamento dei dati"""
    
    def __init__(self):
        self.ensure_data_dir()
        self.config = self.load_config()
    
    def ensure_data_dir(self):
        """Crea la directory dati se non esiste"""
        try:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            logger.info(f"Directory dati: {DATA_DIR}")
        except Exception as e:
            logger.error(f"Errore creazione directory: {e}")
            raise
    
    def load_config(self) -> Dict[str, Any]:
        """Carica la configurazione"""
        try:
            if CONFIG_FILE.exists():
                with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                # Merge con default per nuove opzioni
                merged = DEFAULT_CONFIG.copy()
                merged.update(config)
                return merged
            else:
                self.save_config(DEFAULT_CONFIG)
                return DEFAULT_CONFIG.copy()
        except Exception as e:
            logger.warning(f"Errore caricamento config: {e}, uso default")
            return DEFAULT_CONFIG.copy()
    
    def save_config(self, config: Dict[str, Any]):
        """Salva la configurazione"""
        try:
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            logger.info("Configurazione salvata")
        except Exception as e:
            logger.error(f"Errore salvataggio config: {e}")
    
    def load_notes(self) -> Optional[Dict[str, Any]]:
        """Carica le note dal file"""
        try:
            if NOTES_FILE.exists():
                with open(NOTES_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                logger.info(f"Note caricate: {len(data.get('notes', []))} schede")
                return data
            return None
        except Exception as e:
            logger.error(f"Errore caricamento note: {e}")
            return None
    
    def save_notes(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Salva le note nel file"""
        try:
            # Backup precedente se esiste
            if NOTES_FILE.exists() and self.config['app']['backup_count'] > 0:
                self.create_backup()
            
            with open(NOTES_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            note_count = len(data.get('notes', []))
            logger.info(f"Note salvate: {note_count} schede")
            return {"ok": True, "count": note_count}
            
        except Exception as e:
            logger.error(f"Errore salvataggio note: {e}")
            return {"ok": False, "error": str(e)}
    
    def create_backup(self):
        """Crea un backup delle note esistenti"""
        try:
            backup_dir = DATA_DIR / "backups"
            backup_dir.mkdir(exist_ok=True)
            
            # Mantieni solo gli ultimi N backup
            backups = sorted(backup_dir.glob("notes_*.json"))
            max_backups = self.config['app']['backup_count']
            
            if len(backups) >= max_backups:
                for old_backup in backups[:-max_backups+1]:
                    old_backup.unlink()
            
            # Crea nuovo backup con timestamp
            import datetime
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = backup_dir / f"notes_{timestamp}.json"
            shutil.copy2(NOTES_FILE, backup_path)
            
            logger.info(f"Backup creato: {backup_path.name}")
            
        except Exception as e:
            logger.warning(f"Errore creazione backup: {e}")

# ========== API PER FRONTEND ==========

class RoloMemoAPI:
    """API esposta al frontend JavaScript"""
    
    def __init__(self):
        self.data_manager = DataManager()
    
    def load(self) -> Optional[Dict[str, Any]]:
        """Carica i dati (chiamata da JS)"""
        return self.data_manager.load_notes()
    
    def save(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Salva i dati (chiamata da JS)"""
        return self.data_manager.save_notes(data)
    
    def get_config(self) -> Dict[str, Any]:
        """Restituisce la configurazione"""
        return self.data_manager.config
    
    def update_config(self, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Aggiorna la configurazione"""
        try:
            self.data_manager.config.update(updates)
            self.data_manager.save_config(self.data_manager.config)
            return {"ok": True}
        except Exception as e:
            return {"ok": False, "error": str(e)}
    
    def get_app_info(self) -> Dict[str, Any]:
        """Info sull'applicazione"""
        return {
            "name": APP_NAME,
            "version": APP_VERSION,
            "data_dir": str(DATA_DIR),
            "notes_file": str(NOTES_FILE),
            "config_file": str(CONFIG_FILE)
        }

# ========== HTML TEMPLATE ==========

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RoloMemo</title>
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .line-clamp-3 {
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        
        /* Personalizzazioni tema */
        :root {
            --color-cream: #fff7ea;
            --color-avocado: #7a8f3c;
            --color-burnt: #c1542a;
            --color-ink: #1d1d1f;
            --color-smoke: #3b3b40;
            --color-mustard: #d6a516;
        }
    </style>
</head>
<body>
    <div id="root">
        <div class="min-h-screen flex items-center justify-center" style="background-color: var(--color-cream);">
            <div class="text-center">
                <div class="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent mx-auto mb-4" 
                     style="border-color: var(--color-avocado);"></div>
                <p style="color: var(--color-smoke);">Caricamento RoloMemo...</p>
            </div>
        </div>
    </div>
    
    <script type="text/babel">
        // Il componente React verrà inserito qui dalla funzione create_html
        // REACT_COMPONENT_PLACEHOLDER
        
        // Render dell'app
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(RoloMemo));
    </script>
</body>
</html>"""

# ========== FUNZIONI UTILITÀ ==========

def get_react_component():
    """Legge il componente React dal file o usa quello embedded.
       Cerca sia 'rolomemo_component.js' (underscore) sia 'rolomemo-component.js' (trattino)."""
    base = Path(__file__).parent
    candidates = [
        base / "rolomemo_component.js",
        base / "rolomemo-component.js",
    ]
    for p in candidates:
        if p.exists():
            try:
                txt = p.read_text(encoding="utf-8")
                logger.info(f"✔ Caricato componente da: {p.name}")
                # Segnaposto per fare debug da console nel webview
                return txt + "\n;window.__ROLOMEMO_COMPONENT__ = '" + p.name + "';"
            except Exception as e:
                logger.warning(f"Errore lettura {p.name}: {e}")

    logger.warning("⚠ Componente non trovato. Uso il fallback minimale.")
    return """
    function RoloMemo() {
        return React.createElement('div', {
            className: 'min-h-screen flex items-center justify-center',
            style: { backgroundColor: '#fff7ea' }
        }, React.createElement('div', { className: 'text-center p-8' }, [
            React.createElement('h1', { key: 'title', className: 'text-4xl font-bold mb-4', style: { color: '#1d1d1f' } }, 'RoloMemo'),
            React.createElement('p', { key: 'subtitle', style: { color: '#3b3b40' } }, 'Carica il componente completo in rolomemo_component.js')
        ]));
    }
    """

def create_html():
    """Crea l'HTML finale con il componente React"""
    react_component = get_react_component()
    return HTML_TEMPLATE.replace('// REACT_COMPONENT_PLACEHOLDER', react_component)

# ========== APPLICAZIONE PRINCIPALE ==========

class RoloMemoApp:
    """Applicazione principale"""
    
    def __init__(self):
        self.api = RoloMemoAPI()
        self.window = None

    def inline_html(self) -> str:
        return create_html()
    
    def run(self):
        """Avvia l'applicazione"""
        try:
            config = self.api.data_manager.config
            window_config = config['window']
            
            logger.info(f"Avvio {APP_NAME} v{APP_VERSION}")
            logger.info(f"Directory dati: {DATA_DIR}")
            
            if INDEX_HTML.exists():
                self.window = webview.create_window(
                    title="RoloMemo",
                    url=INDEX_HTML.as_uri(),
                    width=980,
                    height=720,
                    resizable=True,
                    confirm_close=False,
                    js_api=self.api,
                )
            else:
                self.window = webview.create_window(
                    title="RoloMemo",
                    html=create_html(),  # ← usa html= per stringhe HTML
                    width=980,
                    height=720,
                    resizable=True,
                    confirm_close=False,
                    js_api=self.api,
                )

            # Event handlers
            self.window.events.closed += self.on_window_closed
            
            # Avvia l'app
            debug_mode = config['app'].get('debug', False)
            webview.start(debug=debug_mode)
            
        except Exception as e:
            logger.error(f"Errore avvio applicazione: {e}")
            raise
    
    def on_window_closed(self):
        """Gestisce la chiusura della finestra"""
        logger.info("Applicazione chiusa dall'utente")
        # Eventuali operazioni di cleanup qui

# ========== SCRIPT PRINCIPALE ==========

def main():
    """Funzione principale"""
    try:
        # Verifica dipendenze
        import webview
        
        print(f"🚀 Avvio {APP_NAME} v{APP_VERSION}")
        print(f"📁 Directory dati: {DATA_DIR}")
        
        # Crea e avvia l'app
        app = RoloMemoApp()
        app.run()
        
    except ImportError as e:
        print(f"❌ Dipendenza mancante: {e}")
        print("\n🔧 Installa le dipendenze con:")
        print("   pip install pywebview")
        print("   # Su Linux aggiungi: pip install pywebview[gtk]")
        sys.exit(1)
        
    except KeyboardInterrupt:
        print("\n👋 Applicazione interrotta dall'utente")
        sys.exit(0)
        
    except Exception as e:
        print(f"💥 Errore fatale: {e}")
        logger.error(f"Errore fatale: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()