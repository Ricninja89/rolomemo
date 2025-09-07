# setup.py - Script di installazione e packaging
"""
Setup per RoloMemo Desktop App
=============================
"""

from setuptools import setup, find_packages
import os

# Leggi il README se esiste
def read_readme():
    readme_path = os.path.join(os.path.dirname(__file__), 'README.md')
    if os.path.exists(readme_path):
        with open(readme_path, 'r', encoding='utf-8') as f:
            return f.read()
    return "RoloMemo - Applicazione desktop per note in stile Rolodex"

setup(
    name="rolomemo",
    version="1.0.0",
    description="Applicazione desktop per note in stile Rolodex",
    long_description=read_readme(),
    long_description_content_type="text/markdown",
    author="Sviluppatore RoloMemo",
    author_email="dev@rolomemo.com",
    url="https://github.com/your-username/rolomemo",
    
    packages=find_packages(),
    include_package_data=True,
    
    # Dipendenze
    install_requires=[
        "pywebview>=4.0.0",
        # Linux: aggiungerà automaticamente PyGObject se necessario
    ],
    
    # Dipendenze extra per sviluppo
    extras_require={
        "dev": [
            "pytest",
            "black",
            "flake8",
        ]
    },
    
    # Entry points (comandi da terminale)
    entry_points={
        "console_scripts": [
            "rolomemo=rolomemo.main:main",
        ],
    },
    
    # Classificatori PyPI
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: End Users/Desktop",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Topic :: Office/Business :: Groupware",
        "Topic :: Utilities",
    ],
    
    python_requires=">=3.8",
    
    # File di dati da includere
    package_data={
        "rolomemo": [
            "assets/*",
            "templates/*",
            "*.js",
            "*.html",
            "*.css",
        ],
    },
)

# =============================================================================
# requirements.txt - Dipendenze del progetto
# =============================================================================
"""
pywebview>=4.0.0
# Per Linux (opzionale, solo se non già installato):
# PyGObject>=3.42.0

# Dipendenze di sviluppo (opzionali)
pytest>=7.0.0
black>=22.0.0
flake8>=4.0.0
"""

# =============================================================================
# build_installer.py - Script per creare l'installabile
# =============================================================================
import os
import sys
import subprocess
import shutil
from pathlib import Path

def create_installer():
    """Crea l'installabile per la piattaforma corrente"""
    
    print("🔧 Preparazione build RoloMemo...")
    
    # Directory del progetto
    project_dir = Path(__file__).parent
    build_dir = project_dir / "build"
    dist_dir = project_dir / "dist"
    
    # Pulisci directory precedenti
    for dir_path in [build_dir, dist_dir]:
        if dir_path.exists():
            shutil.rmtree(dir_path)
            print(f"🗑️ Pulita directory: {dir_path}")
    
    try:
        # Verifica che PyInstaller sia installato
        subprocess.check_call([sys.executable, "-c", "import PyInstaller"])
    except subprocess.CalledProcessError:
        print("📦 Installazione PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
    
    # Opzioni PyInstaller
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--name", "RoloMemo",
        "--windowed",  # No console su Windows
        "--onefile",   # Un singolo eseguibile
        "--icon", str(project_dir / "assets" / "icon.ico") if (project_dir / "assets" / "icon.ico").exists() else None,
        # Aggiungi file necessari
        "--add-data", f"{project_dir / 'rolomemo_component.js'};.",
        # Entry point
        str(project_dir / "rolomemo.py")
    ]
    
    # Rimuovi None values
    cmd = [arg for arg in cmd if arg is not None]
    
    print(f"🚀 Creazione eseguibile...")
    print(f"Comando: {' '.join(cmd)}")
    
    result = subprocess.run(cmd, cwd=project_dir)
    
    if result.returncode == 0:
        print("✅ Build completata!")
        
        # Mostra risultati
        executable_dir = dist_dir
        if executable_dir.exists():
            executables = list(executable_dir.glob("RoloMemo*"))
            if executables:
                exe_path = executables[0]
                size_mb = exe_path.stat().st_size / (1024 * 1024)
                print(f"📦 Eseguibile creato: {exe_path}")
                print(f"📏 Dimensione: {size_mb:.1f} MB")
                
                return exe_path
        
    else:
        print("❌ Errore durante la build!")
        return None

def create_portable_package():
    """Crea un pacchetto portable con Python embedded (Windows)"""
    print("📦 Creazione pacchetto portable...")
    
    project_dir = Path(__file__).parent
    portable_dir = project_dir / "RoloMemo_Portable"
    
    # Crea directory portable
    portable_dir.mkdir(exist_ok=True)
    
    # Copia i file necessari
    files_to_copy = [
        "rolomemo.py",
        "rolomemo_component.js",
        "requirements.txt",
        "README.md"
    ]
    
    for file_name in files_to_copy:
        src = project_dir / file_name
        if src.exists():
            shutil.copy2(src, portable_dir / file_name)
    
    # Crea script di avvio
    if sys.platform == "win32":
        start_script = portable_dir / "avvia_rolomemo.bat"
        with open(start_script, 'w') as f:
            f.write("""@echo off
echo Avvio RoloMemo...
python rolomemo.py
pause
""")
    else:
        start_script = portable_dir / "avvia_rolomemo.sh"
        with open(start_script, 'w') as f:
            f.write("""#!/bin/bash
echo "Avvio RoloMemo..."
python3 rolomemo.py
""")
        start_script.chmod(0o755)
    
    # Crea script di installazione dipendenze
    install_script = portable_dir / "installa_dipendenze.py"
    with open(install_script, 'w') as f:
        f.write("""#!/usr/bin/env python3
import subprocess
import sys

def install_requirements():
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Dipendenze installate con successo!")
    except Exception as e:
        print(f"❌ Errore installazione: {e}")
        input("Premi Enter per continuare...")

if __name__ == "__main__":
    install_requirements()
""")
    
    print(f"✅ Pacchetto portable creato: {portable_dir}")
    return portable_dir

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Build RoloMemo")
    parser.add_argument("--portable", action="store_true", help="Crea pacchetto portable invece dell'eseguibile")
    parser.add_argument("--all", action="store_true", help="Crea sia eseguibile che pacchetto portable")
    
    args = parser.parse_args()
    
    if args.all or not (args.portable):
        exe_path = create_installer()
    
    if args.all or args.portable:
        portable_path = create_portable_package()
    
    print("\n🎉 Build completata!")

# =============================================================================
# Makefile alternativo per automazione
# =============================================================================
"""
# Makefile per RoloMemo

.PHONY: install dev build portable clean test run

# Installazione per sviluppo
dev:
	pip install -e .
	pip install -r requirements-dev.txt

# Installazione normale
install:
	pip install -r requirements.txt

# Build eseguibile
build:
	python build_installer.py

# Pacchetto portable
portable:
	python build_installer.py --portable

# Build completo
all:
	python build_installer.py --all

# Pulizia
clean:
	rm -rf build/ dist/ *.egg-info/
	find . -name "*.pyc" -delete
	find . -name "__pycache__" -delete

# Test
test:
	python -m pytest tests/

# Avvio diretto
run:
	python rolomemo.py

# Formattazione codice
format:
	black .
	flake8 .
"""