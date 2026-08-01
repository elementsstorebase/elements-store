; Script de Inno Setup para Elements Store
; =============================================
; Requisitos: Inno Setup (https://jrsoftware.org/isinfo.php)
; Compilar: Abrir este archivo con Inno Setup y presionar "Compile"

[Setup]
; Información general
AppName=Elements Store
AppVersion=1.0
AppPublisher=Elements Store
AppPublisherURL=https://www.elementsstore.com
AppSupportURL=https://www.elementsstore.com/soporte
AppUpdatesURL=https://www.elementsstore.com/actualizaciones
DefaultDirName={pf}\ElementsStore
DefaultGroupName=Elements Store
UninstallDisplayIcon={app}\ElementsStore.exe
Compression=lzma2
SolidCompression=yes
OutputDir=.
OutputBaseFilename=ElementsStore_Setup
; SetupIconFile=app.ico   ; (opcional) si tienes un icono para el instalador, descomenta esta línea
Uninstallable=yes
CreateUninstallRegKey=yes
UninstallFilesDir={app}\uninstall

; Permisos (para que el programa pueda escribir en su propia carpeta)
PrivilegesRequired=admin

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "Crear acceso directo en el escritorio"; GroupDescription: "Accesos directos adicionales:"; Flags: unchecked

[Files]
; El ejecutable principal (generado con PyInstaller)
Source: "dist\ElementsStore.exe"; DestDir: "{app}"; Flags: ignoreversion

; Carpeta de fuentes (necesaria para los tickets)
Source: "fonts\*"; DestDir: "{app}\fonts"; Flags: recursesubdirs createallsubdirs

; (Opcional) Si tienes un archivo .env con variables por defecto
; Source: ".env"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; Acceso directo en el menú de inicio
Name: "{group}\Elements Store"; Filename: "{app}\ElementsStore.exe"; WorkingDir: "{app}"
; Acceso directo al desinstalador
Name: "{group}\Desinstalar Elements Store"; Filename: "{uninstallexe}"
; Acceso directo en el escritorio (opcional)
Name: "{commondesktop}\Elements Store"; Filename: "{app}\ElementsStore.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
; Ejecutar el programa después de la instalación (opcional)
Filename: "{app}\ElementsStore.exe"; Description: "Ejecutar Elements Store"; Flags: postinstall nowait skipifsilent

[UninstallRun]
; (Opcional) Cerrar el programa antes de desinstalar
Filename: "{app}\ElementsStore.exe"; Parameters: "/close"; Flags: runhidden; Check: AppRunning

[Code]
// Función para verificar si el programa está en ejecución (para el desinstalador)
function AppRunning(): Boolean;
var
  ErrorCode: Integer;
begin
  ShellExec('', 'tasklist', '/FI "IMAGENAME eq ElementsStore.exe"', '', SW_HIDE, ewWaitUntilTerminated, ErrorCode);
  Result := (ErrorCode = 0);
end;