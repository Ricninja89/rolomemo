# Build_installer.py
import os
import sys
import subprocess
import shutil
from pathlib import Path

PROJECT_DIR = Path(__file__).parent.resolve()
DIST_DIR = PROJECT_DIR / "dist"
Build_DIR = PROJECT_DIR / "Build"

# Toggle onefile via env var (default: onedir perché più semplice per asset/js)
ONEFILE = os.environ.get("ROLOMEMO_ONEFILE", "").strip() in ("1", "true", "yes")

def run(cmd):
    print(">", " ".join(map(str, cmd)))
    subprocess.check_call(cmd, cwd=PROJECT_DIR)

def add_data_arg(src: Path, dest: str = ".") -> list[str]:
    """
    Crea l'argomento --add-data per PyInstaller rispettando il separatore
    corretto (Windows usa ';', Unix usa ':').
    """
    sep = ";" if sys.platform.startswith("win") else ":"
    return ["--add-data", f"{src}{sep}{dest}"]

def main():
    # Pulizia Build precedente
    for p in (Build_DIR, DIST_DIR):
        if p.exists():
            shutil.rmtree(p)

    # Assicura PyInstaller
    try:
        __import__("PyInstaller")  # noqa
    except ImportError:
        run([sys.executable, "-m", "pip", "install", "pyinstaller"])

    # Comando base
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--name", "RoloMemo",
        "--windowed",
        "--noconfirm",
        "--clean",
        # pywebview a volte carica sottopacchetti dinamicamente: includiamoli
        "--collect-submodules", "webview",
        "--collect-data", "webview",
    ]

    # Modalità onefile/opzionale
    if ONEFILE:
        cmd.append("--onefile")
    else:
        # onedir (predefinito): niente flag necessario, ma esplicitiamo per chiarezza
        cmd.append("--onedir")

    # Asset JS del componente React (necessario per l'UI)
    comp_js = PROJECT_DIR / "rolomemo_component.js"
    if comp_js.exists():
        cmd += add_data_arg(comp_js, ".")
    else:
        print("! Attenzione: rolomemo_component.js non trovato. Verrà usato il fallback embedded.")

    # (Opzionale) includi la cartella assets se esiste (icone, ecc.)
    assets_dir = PROJECT_DIR / "assets"
    if assets_dir.exists():
        # Copiamo la directory così com'è in runtime (es. 'assets/')
        # PyInstaller richiede singolo path; passiamo la radice e destinazione 'assets'
        cmd += add_data_arg(assets_dir, "assets")

    # (Opzionale) includi 'dist' se usi un index.html/bundle esterno
    dist_web = PROJECT_DIR / "dist"
    if dist_web.exists():
        cmd += add_data_arg(dist_web, "dist")

    # Icona (se presente)
    icon = assets_dir / "icon.ico"
    if icon.exists():
        cmd += ["--icon", str(icon)]

    # Entry point
    cmd += [str(PROJECT_DIR / "rolomemo.py")]

    # Esegui
    run(cmd)

    # Report esito
    if ONEFILE:
        exe = next(DIST_DIR.glob("RoloMemo*"), None)
        if exe:
            print(f"\nBuild ONE-FILE OK: {exe}")
        else:
            print("\nNessun eseguibile trovato in dist/")
    else:
        app_dir = DIST_DIR / "RoloMemo"
        if app_dir.exists():
            print(f"\nBuild ONE-DIR OK: {app_dir}")
        else:
            print("\nNessuna cartella app trovata in dist/")

    # Nota importante per PyInstaller ONE-FILE:
    # Se più avanti vorrai usare --onefile, assicurati che il codice che legge
    # 'rolomemo_component.js' gestisca anche sys._MEIPASS. Con ONE-DIR non serve.

if __name__ == "__main__":
    main()









