@echo off
echo ================================================
echo  Elements Store - Compilacion del Ejecutable
echo ================================================
echo.

echo [1/4] Instalando dependencias necesarias...
pip install pyinstaller==6.3.0

echo.
echo [2/4] Limpiando compilaciones anteriores...
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
if exist *.spec del /q *.spec

echo.
echo [3/4] Generando archivo .spec y compilando...
pyinstaller elements_store.spec

echo.
echo [4/4] Compilacion completada!
echo.
echo El ejecutable se encuentra en: dist\elements_store\elements_store.exe
echo.
echo Para probarlo, ejecuta:
echo   dist\elements_store\elements_store.exe
echo.
pause