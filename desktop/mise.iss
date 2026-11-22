; Mise for Windows - per-user installer (no admin rights). build.py compiles it with:
;   iscc /DAppVersion=1.0.0 /DSourceDir=<dist\Mise> /DOutputDir=<dist> /DIconFile=<build\mise.ico> mise.iss
; Installs to %LOCALAPPDATA%\Programs\Mise, adds Mise to the Start menu (and optionally the desktop) and lists it
; in Settings > Apps. The window keeps its data (what you saved in it) in %LOCALAPPDATA%\Mise, which
; uninstalling leaves in place so a reinstall finds it again.

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#ifndef SourceDir
  #define SourceDir "dist\Mise"
#endif
#ifndef OutputDir
  #define OutputDir "dist"
#endif
#ifndef IconFile
  #define IconFile "build\mise.ico"
#endif

[Setup]
AppId={{E81247BA-698B-569E-A6DE-E1E1C366EEFB}
AppName=Mise
AppVersion={#AppVersion}
AppVerName=Mise {#AppVersion}
AppPublisher=Juwen Lie
AppPublisherURL=https://juw12.github.io/mise/
AppSupportURL=https://github.com/juw12/mise
DefaultDirName={autopf}\Mise
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir={#OutputDir}
OutputBaseFilename=Mise-Windows-Setup
SetupIconFile={#IconFile}
UninstallDisplayIcon={app}\Mise.exe
UninstallDisplayName=Mise
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=no
SetupLogging=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{userprograms}\Mise"; Filename: "{app}\Mise.exe"; Comment: "Mise is a quiet cooking game"
Name: "{userdesktop}\Mise"; Filename: "{app}\Mise.exe"; Comment: "Mise is a quiet cooking game"; Tasks: desktopicon

[Run]
Filename: "{app}\Mise.exe"; Description: "{cm:LaunchProgram,Mise}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{app}\Mise.exe"; Parameters: "--stop"; Flags: runhidden waituntilterminated; RunOnceId: "StopMise"

[Code]
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Result := '';
  { Updating: close an open Mise window first so its files can be replaced. }
  if FileExists(ExpandConstant('{app}\Mise.exe')) then
    Exec(ExpandConstant('{app}\Mise.exe'), '--stop', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;
