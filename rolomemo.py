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
import zipfile
import mimetypes
from pathlib import Path
from typing import Dict, Any, Optional

try:
    import webview
except ImportError:
    print("PyWebView non installato. Installa con: pip install pywebview")
    print("Su Linux puoi usare: pip install 'pywebview[gtk]'")
    sys.exit(1)

from pathlib import Path  # se non c'è già


def resource_path(relative: str) -> Path:
    """Restituisce il percorso reale di una risorsa.
    Gestisce sia l'esecuzione da sorgente sia da PyInstaller (sys._MEIPASS)."""
    base = getattr(sys, "_MEIPASS", Path(__file__).resolve().parent)
    return Path(base) / relative


BASE_DIR = resource_path("")

# ========== CONFIGURAZIONE ==========

APP_NAME = "RoloMemo"
APP_VERSION = "1.0.3"
DATA_DIR_NAME = "rolomemo"

def _user_data_base() -> Path:
    """Percorso base per i dati utente, robusto su tutte le piattaforme.
    Evita di restare con Path('.') quando APPDATA non è valorizzata.
    """
    if os.name == 'nt':  # Windows
        appdata = os.environ.get('APPDATA', '')
        if appdata and appdata.strip():
            return Path(appdata)
        # Fallback standard
        return Path.home() / 'AppData' / 'Roaming'
    elif sys.platform == 'darwin':  # macOS
        return Path.home() / 'Library' / 'Application Support'
    else:  # Linux/Unix
        return Path.home() / '.local' / 'share'

# Determina la directory dati dell'utente
DATA_BASE = _user_data_base()

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
        "theme": "light",
        "auto_start": False
    }
}

# ========== LOGGING SETUP ==========

class _ConsoleSanitizeFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            enc = getattr(sys.stdout, 'encoding', None) or 'utf-8'
            # Compute formatted message and strip non encodable chars
            msg = record.getMessage()
            safe = msg.encode(enc, errors='ignore').decode(enc, errors='ignore')
            record.msg = safe
            record.args = ()
        except Exception:
            pass
        return True

def setup_logging():
    """Configura il sistema di logging"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    # File handler (UTF-8) e console handler con filtro di sanitizzazione
    file_handler = logging.FileHandler(LOG_FILE, encoding='utf-8')
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.addFilter(_ConsoleSanitizeFilter())

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[file_handler, console_handler],
    )
    return logging.getLogger(__name__)

logger = setup_logging()

# ========== GESTIONE DATI ==========

# Stampa sicura su Windows (evita errori unicode su console cp1252)
def _safe_print(*args, **kwargs):
    try:
        builtins_print = __builtins__['print'] if isinstance(__builtins__, dict) else __builtins__.print
    except Exception:
        builtins_print = print  # fallback
    try:
        builtins_print(*args, **kwargs)
    except UnicodeEncodeError:
        txt = " ".join(str(a) for a in args)
        # Rimuove caratteri non codificabili per la console corrente
        filtered = txt.encode(sys.stdout.encoding or 'utf-8', errors='ignore').decode(sys.stdout.encoding or 'utf-8', errors='ignore')
        builtins_print(filtered)

# Sovrascrive print nel modulo
print = _safe_print

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
            # Carica stato corrente per salvaguardia
            existing = None
            try:
                if NOTES_FILE.exists():
                    with open(NOTES_FILE, 'r', encoding='utf-8') as f:
                        existing = json.load(f)
            except Exception:
                existing = None

            incoming_notes = data.get('notes', []) if isinstance(data, dict) else []
            incoming_count = len(incoming_notes) if isinstance(incoming_notes, list) else 0
            existing_count = len(existing.get('notes', [])) if isinstance(existing, dict) else 0
            incoming_ts = int(data.get('updatedAt', 0)) if isinstance(data, dict) else 0
            existing_ts = int((existing or {}).get('updatedAt', 0))

            # Salvaguardia anti-azzeramento: se il nuovo payload ha molte meno note e timestamp non piu' recente, rifiuta
            if existing_count > 0 and incoming_count >= 0:
                too_much_loss = (incoming_count < max(1, int(existing_count * 0.5)))
                not_newer = incoming_ts and existing_ts and (incoming_ts <= existing_ts)
                if (incoming_count == 0 and not_newer) or (too_much_loss and not_newer):
                    logger.warning("Salvataggio rifiutato per salvaguardia: perdita note significativa o timestamp non piu' recente")
                    return {"ok": False, "error": "Safeguard: prevenuto un salvataggio che avrebbe perso molte note"}

            # Backup precedente se esiste
            backup_count = int(self.config.get('app', {}).get('backup_count', DEFAULT_CONFIG['app']['backup_count']))
            if NOTES_FILE.exists() and backup_count > 0:
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
        """Crea un backup delle note esistenti.
        - Continua a creare il backup JSON singolo (compatibilità).
        - In aggiunta crea uno ZIP completo che include notes.json e la cartella attachments/.
        """
        try:
            backup_dir = DATA_DIR / "backups"
            backup_dir.mkdir(exist_ok=True)
            
            # Mantieni solo gli ultimi N backup
            backups_json = sorted(backup_dir.glob("notes_*.json"))
            backups_zip = sorted(backup_dir.glob("backup_*.zip"))
            max_backups = int(self.config.get('app', {}).get('backup_count', DEFAULT_CONFIG['app']['backup_count']))
            
            if len(backups_json) >= max_backups:
                for old_backup in backups_json[:-max_backups+1]:
                    try:
                        old_backup.unlink()
                    except Exception:
                        pass
            if len(backups_zip) >= max_backups:
                for old_zip in backups_zip[:-max_backups+1]:
                    try:
                        old_zip.unlink()
                    except Exception:
                        pass
            
            # Crea nuovo backup con timestamp
            import datetime
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            # 1) JSON semplice (compatibilità)
            backup_json = backup_dir / f"notes_{timestamp}.json"
            if NOTES_FILE.exists():
                shutil.copy2(NOTES_FILE, backup_json)
            # 2) ZIP completo (notes.json + attachments/)
            backup_zip = backup_dir / f"backup_{timestamp}.zip"
            with zipfile.ZipFile(backup_zip, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
                # notes.json
                if NOTES_FILE.exists():
                    zf.write(NOTES_FILE, arcname='notes.json')
                # attachments directory
                attach_dir = DATA_DIR / 'attachments'
                if attach_dir.exists() and attach_dir.is_dir():
                    for root, _, files in os.walk(attach_dir):
                        root_p = Path(root)
                        for name in files:
                            fp = root_p / name
                            rel = fp.relative_to(DATA_DIR)
                            zf.write(fp, arcname=str(rel).replace('\\', '/'))
            
            logger.info(f"Backup creati: {backup_json.name}{' + ' + backup_zip.name if backup_zip.exists() else ''}")
            
        except Exception as e:
            logger.warning(f"Errore creazione backup: {e}")

    def list_backups(self):
        try:
            backup_dir = DATA_DIR / "backups"
            if not backup_dir.exists():
                return []
            return sorted(backup_dir.glob("notes_*.json"), reverse=True)
        except Exception:
            return []

    def restore_last_backup(self) -> Dict[str, Any]:
        try:
            backups = self.list_backups()
            if not backups:
                return {"ok": False, "error": "Nessun backup disponibile"}
            latest = backups[0]
            shutil.copy2(latest, NOTES_FILE)
            logger.info(f"Ripristinato backup: {latest.name}")
            return {"ok": True, "file": str(latest)}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    # ===== Avvio automatico (Windows) =====
    @staticmethod
    def _is_windows() -> bool:
        return os.name == 'nt'

    def get_auto_start_status(self) -> Dict[str, Any]:
        """Verifica se l'avvio automatico su Windows è attivo (Run key HKCU).
        Su altri sistemi ritorna sempre False con info di piattaforma.
        """
        if not self._is_windows():
            return {"ok": True, "enabled": False, "platform": sys.platform}
        try:
            import winreg
            run_key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, run_key_path, 0, winreg.KEY_READ) as key:
                try:
                    val, _ = winreg.QueryValueEx(key, APP_NAME)
                    enabled = isinstance(val, str) and len(val.strip()) > 0
                except FileNotFoundError:
                    enabled = False
            return {"ok": True, "enabled": enabled}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def set_auto_start(self, enabled: bool) -> Dict[str, Any]:
        """Abilita/disabilita l'avvio automatico su Windows scrivendo nel registro HKCU Run.
        Aggiorna anche la config locale (app.auto_start).
        """
        if not self._is_windows():
            # Aggiorna solo la config per coerenza, ma segnala la piattaforma
            try:
                self.config.setdefault('app', {})['auto_start'] = bool(enabled)
                self.save_config(self.config)
            except Exception:
                pass
            return {"ok": False, "error": "Auto-start disponibile solo su Windows"}

        try:
            import winreg
            run_key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"

            # Costruisci il comando di avvio
            if getattr(sys, '_MEIPASS', None):
                # PyInstaller onefile: eseguibile stesso
                cmd = f'"{sys.executable}"'
            else:
                # Sorgente: prova pythonw.exe se disponibile per evitare console
                exe = Path(sys.executable)
                pyw = exe.with_name('pythonw.exe')
                pybin = pyw if pyw.exists() else exe
                script = Path(__file__).resolve()
                cmd = f'"{pybin}" "{script}"'

            with winreg.CreateKey(winreg.HKEY_CURRENT_USER, run_key_path) as key:
                if enabled:
                    winreg.SetValueEx(key, APP_NAME, 0, winreg.REG_SZ, cmd)
                else:
                    try:
                        winreg.DeleteValue(key, APP_NAME)
                    except FileNotFoundError:
                        pass

            # Aggiorna config
            self.config.setdefault('app', {})['auto_start'] = bool(enabled)
            self.save_config(self.config)
            return {"ok": True, "enabled": bool(enabled)}
        except Exception as e:
            return {"ok": False, "error": str(e)}

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
            # Unione profonda almeno per la sezione 'app' per non perdere chiavi
            cfg = self.data_manager.config
            if isinstance(updates, dict):
                app_upd = updates.get('app') if isinstance(updates.get('app'), dict) else None
                # aggiorna altre chiavi top-level (senza 'app')
                for k, v in updates.items():
                    if k == 'app':
                        continue
                    cfg[k] = v
                # unione app
                if app_upd is not None:
                    cfg.setdefault('app', {})
                    cfg['app'].update(app_upd)
            else:
                # fallback: semplice
                cfg.update(updates)
            self.data_manager.save_config(cfg)
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

    # Utility: apri percorso o URL con l'app di sistema
    def open_path(self, target: str) -> Dict[str, Any]:
        try:
            import webbrowser
            t = str(target or '').strip()
            if not t:
                return {"ok": False, "error": "Percorso/URL vuoto"}
            low = t.lower()
            if low.startswith('http://') or low.startswith('https://'):
                webbrowser.open(t)
                return {"ok": True}
            # file:// -> path locale
            if low.startswith('file://'):
                from urllib.parse import urlparse, unquote
                p = urlparse(t)
                path = unquote(p.path)
            else:
                path = t
            path = str(Path(path))
            if os.name == 'nt':
                os.startfile(path)  # type: ignore[attr-defined]
            elif sys.platform == 'darwin':
                import subprocess
                subprocess.Popen(['open', path])
            else:
                import subprocess
                subprocess.Popen(['xdg-open', path])
            return {"ok": True}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def pick_attachments(self) -> Dict[str, Any]:
        """Apre un file dialog nativo e ritorna i percorsi selezionati.
        Ritorna una lista di path assoluti. Nessuna copia viene eseguita qui.
        """
        try:
            import webview as _wv
            wins = getattr(_wv, 'windows', [])
            win = wins[0] if wins else None
            if not win:
                return {"ok": False, "error": "Nessuna finestra attiva"}
            files = win.create_file_dialog(_wv.OPEN_DIALOG, allow_multiple=True)
            # files può essere None o lista di stringhe
            if not files:
                return {"ok": True, "files": []}
            # Normalizza in stringhe
            out = [str(p) for p in files]
            return {"ok": True, "files": out}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def copy_attachments(self, note_id: str, files: Any) -> Dict[str, Any]:
        """Copia una lista di file nel vault degli allegati della nota.
        Ritorna per ciascun file: name, path assoluto, url file:// e mime.
        """
        try:
            if not note_id or not isinstance(note_id, str):
                return {"ok": False, "error": "note_id mancante"}
            arr = files if isinstance(files, (list, tuple)) else []
            dest_dir = DATA_DIR / 'attachments' / note_id
            dest_dir.mkdir(parents=True, exist_ok=True)
            out = []
            for item in arr:
                try:
                    src = Path(str(item))
                    if not src.exists() or not src.is_file():
                        continue
                    base = src.name
                    safe = base.replace('\\', '_').replace('/', '_')
                    target = dest_dir / safe
                    # Evita collisioni aggiungendo suffisso numerico
                    if target.exists():
                        stem = target.stem
                        suffix = target.suffix
                        k = 2
                        while True:
                            cand = dest_dir / f"{stem} ({k}){suffix}"
                            if not cand.exists():
                                target = cand
                                break
                            k += 1
                    shutil.copy2(src, target)
                    mime, _ = mimetypes.guess_type(str(target))
                    out.append({
                        'name': target.name,
                        'path': str(target),
                        'url': Path(target).as_uri(),
                        'mime': mime or 'application/octet-stream'
                    })
                except Exception as ie:
                    logging.warning(f"Errore copia allegato {item}: {ie}")
            return {"ok": True, "items": out}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def save_attachment(self, source_path: str, suggested_name: Optional[str] = None) -> Dict[str, Any]:
        """Chiede una destinazione e copia il file selezionato.
        Ritorna il percorso di destinazione se l'utente conferma, altrimenti ok=True e files=[].
        """
        try:
            sp = Path(str(source_path))
            if not sp.exists():
                return {"ok": False, "error": "Sorgente inesistente"}
            import webview as _wv
            wins = getattr(_wv, 'windows', [])
            win = wins[0] if wins else None
            if not win:
                return {"ok": False, "error": "Nessuna finestra attiva"}
            default_name = suggested_name or sp.name
            # pywebview 4/5: SAVE_DIALOG, 6+: FileDialog.SAVE
            try:
                dlg_type = _wv.FileDialog.SAVE  # type: ignore[attr-defined]
            except Exception:
                dlg_type = _wv.SAVE_DIALOG  # type: ignore[attr-defined]
            dest = win.create_file_dialog(dlg_type, save_filename=default_name)
            if not dest:
                return {"ok": True, "saved": None}
            # dest può essere str o list
            if isinstance(dest, (list, tuple)):
                dest_path = Path(dest[0]) if dest else None
            else:
                dest_path = Path(dest)
            if not dest_path:
                return {"ok": True, "saved": None}
            dest_path = dest_path if dest_path.suffix else dest_path.with_name(default_name)
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(sp, dest_path)
            return {"ok": True, "saved": str(dest_path)}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    # Auto-start Windows
    def get_auto_start_status(self) -> Dict[str, Any]:
        return self.data_manager.get_auto_start_status()

    def set_auto_start(self, enabled: bool) -> Dict[str, Any]:
        return self.data_manager.set_auto_start(bool(enabled))

    # Backups
    def restore_last_backup(self) -> Dict[str, Any]:
        return self.data_manager.restore_last_backup()

# ========== HTML TEMPLATE ==========

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RoloMemo</title>
    <script src="{react}"></script>
    <script src="{react_dom}"></script>
    <script src="{babel}"></script>
    <link rel="stylesheet" href="{tailwind}">
    <style>
        .line-clamp-3 {{
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }}

        /* Personalizzazioni tema */
        :root {{
            --color-cream: #fff7ea;
            --color-avocado: #7a8f3c;
            --color-burnt: #c1542a;
            --color-ink: #1d1d1f;
            --color-smoke: #3b3b40;
            --color-mustard: #d6a516;
        }}
    </style>
    <script>
      // Mostra errori JS in pagina per debug in caso di engine legacy
      window.onerror = function(message, source, lineno, colno, error) {{
        try {{
          const box = document.createElement('div');
          box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;background:#fffaf1;border:1px solid #e5dfd2;color:#1d1d1f;padding:12px;border-radius:8px;z-index:99999;font-family:system-ui,Arial,sans-serif;max-height:40vh;overflow:auto';
          box.innerHTML = '<b>Errore JS:</b> ' + String(message) + '<br><small>' + String(source) + ':' + lineno + ':' + colno + '</small>';
          document.body.appendChild(box);
        }} catch(_) {{}}
      }};
    </script>
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
    
    <script type="text/babel" data-presets="env,react" data-plugins="proposal-optional-chaining,proposal-nullish-coalescing-operator,proposal-class-properties,transform-object-rest-spread">
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
    base = resource_path("")
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
    # Costruisci path asset locali
    react_path = resource_path("assets/react.production.min.js")
    react_dom_path = resource_path("assets/react-dom.production.min.js")
    babel_path = resource_path("assets/babel-standalone.min.js")
    tailwind_path = resource_path("assets/tailwind.css")

    def asset_missing(p: Path) -> bool:
        try:
            if not p.exists():
                return True
            # Considera placeholder/mini-file come mancanti
            if p.suffix == ".js":
                if p.stat().st_size < 1024:
                    return True
            elif p.suffix == ".css":
                if p.stat().st_size < 256:
                    return True
            # Controllo contenuto placeholder (prime 200 byte)
            head = p.read_text(encoding="utf-8", errors="ignore")[:200].lower()
            return "placeholder" in head
        except Exception:
            return True

    # Verifica asset; se mancanti, mostra una pagina di errore esplicita
    missing = [str(p) for p in [react_path, react_dom_path, babel_path, tailwind_path] if asset_missing(p)]
    if missing:
        logger.error("Asset mancanti: %s", ", ".join(missing))
        return f"""
        <!DOCTYPE html>
        <html lang=\"it\">
        <head>
            <meta charset=\"UTF-8\">
            <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
            <title>RoloMemo - Errore asset</title>
            <style>
              body {{ font-family: system-ui, Arial, sans-serif; background:#fff7ea; color:#1d1d1f; }}
              code {{ background:#fff2d8; padding:2px 4px; border-radius:4px; }}
              .box {{ max-width: 820px; margin: 10vh auto; background:#fffaf1; border:1px solid #e5dfd2; border-radius:12px; padding:24px; }}
              li {{ margin:6px 0; }}
            </style>
        </head>
        <body>
            <div class=\"box\">
                <h1>Impossibile avviare l'interfaccia</h1>
                <p>Mancano alcuni file nella cartella <code>assets/</code> richiesti per l'esecuzione offline.</p>
                <p>File mancanti:</p>
                <ul>
                    {''.join(f'<li><code>{m}</code></li>' for m in missing)}
                </ul>
                <p>Assicurati che in <code>assets/</code> siano presenti i seguenti file reali (non placeholder):</p>
                <ul>
                    <li><code>react.production.min.js</code> (UMD)</li>
                    <li><code>react-dom.production.min.js</code> (UMD)</li>
                    <li><code>babel-standalone.min.js</code></li>
                    <li><code>tailwind.css</code> (CSS già compilato)</li>
                </ul>
            </div>
        </body>
        </html>
        """

    assets = {
        "react": react_path.as_uri(),
        "react_dom": react_dom_path.as_uri(),
        "babel": babel_path.as_uri(),
        "tailwind": tailwind_path.as_uri(),
    }
    react_component = get_react_component()
    html = HTML_TEMPLATE.format(**assets)
    return html.replace('// REACT_COMPONENT_PLACEHOLDER', react_component)

# ========== APPLICAZIONE PRINCIPALE ==========

class RoloMemoApp:
    """Applicazione principale"""
    
    def __init__(self):
        self.api = RoloMemoAPI()
        self.window = None
        self._temp_html: Optional[Path] = None

    def inline_html(self) -> str:
        return create_html()
    
    def run(self):
        """Avvia l'applicazione"""
        try:
            config = self.api.data_manager.config
            # window_config = config['window']  # riservato per futuri usi

            logger.info(f"Avvio {APP_NAME} v{APP_VERSION}")
            logger.info(f"Directory dati: {DATA_DIR}")

            # Genera sempre un file HTML temporaneo (compatibile con PyInstaller onefile)
            html = create_html()
            try:
                tmp_dir = Path(tempfile.gettempdir())
                tmp_dir.mkdir(parents=True, exist_ok=True)
                tmp_path = tmp_dir / f"rolomemo_{os.getpid()}_{int(__import__('time').time())}.html"
                tmp_path.write_text(html, encoding="utf-8")
                self._temp_html = tmp_path
            except Exception as e:
                logger.error(f"Impossibile creare file HTML temporaneo: {e}")
                raise

            self.window = webview.create_window(
                title="RoloMemo",
                url=self._temp_html.as_uri() if self._temp_html else None,
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
            # Forza Edge (Chromium) su Windows per evitare MSHTML/IE che blocca Babel/React
            gui_backend = None
            if os.name == 'nt':
                gui_backend = 'edgechromium'
            # Profilo persistente per storage (localStorage/cookie) per evitare reset ad ogni avvio
            storage_dir = DATA_DIR / 'webview_profile'
            try:
                storage_dir.mkdir(parents=True, exist_ok=True)
            except Exception:
                pass
            try:
                if gui_backend:
                    logger.info(f"Avvio webview con backend: {gui_backend}")
                    webview.start(
                        debug=debug_mode,
                        gui=gui_backend,
                        private_mode=False,
                        storage_path=str(storage_dir)
                    )
                else:
                    webview.start(debug=debug_mode, private_mode=False, storage_path=str(storage_dir))
            except Exception as e:
                logger.warning(f"Backend {gui_backend} non disponibile ({e}), fallback predefinito")
                webview.start(debug=debug_mode, private_mode=False, storage_path=str(storage_dir))
            
        except Exception as e:
            logger.error(f"Errore avvio applicazione: {e}")
            raise
    
    def on_window_closed(self):
        """Gestisce la chiusura della finestra"""
        logger.info("Applicazione chiusa dall'utente")
        # Eventuali operazioni di cleanup qui
        try:
            if self._temp_html and self._temp_html.exists():
                self._temp_html.unlink(missing_ok=True)
        except Exception:
            pass

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


