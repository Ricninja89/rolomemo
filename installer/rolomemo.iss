#define MyAppName "RoloMemo"
#ifndef MyAppVersion
#define MyAppVersion "1.0.3"
#endif
#define MyAppPublisher "RoloMemo Team"
#define MyAppURL "https://github.com/Ricninja89/rolomemo"

[Setup]
AppId={{84A0E6B6-3B5E-4C2C-9C1C-3F0A7E8C2E91}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableDirPage=no
DisableProgramGroupPage=no
AllowNoIcons=yes
OutputBaseFilename={#MyAppName}-Setup-v{#MyAppVersion}
; Output relative to repo root (script resides in installer/)
OutputDir=..\dist\installer
Compression=lzma
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64
; Optional app icon. Uncomment and ensure path exists
; SetupIconFile=..\assets\icon.ico
UninstallDisplayIcon={app}\RoloMemo.exe
; Signing handled in CI with signtool after build

[Languages]
Name: "italian"; MessagesFile: "compiler:Languages\Italian.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Crea un'icona sul Desktop"; GroupDescription: "Icone:"; Flags: unchecked

[Files]
; Installa l'eseguibile PyInstaller onefile
Source: "..\dist\RoloMemo.exe"; DestDir: "{app}"; DestName: "RoloMemo.exe"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\RoloMemo.exe"
Name: "{commondesktop}\{#MyAppName}"; Filename: "{app}\RoloMemo.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\RoloMemo.exe"; Description: "Avvia {#MyAppName}"; Flags: nowait postinstall skipifsilent

