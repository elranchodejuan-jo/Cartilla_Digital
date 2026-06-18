@echo off
title Cartilla Digital - Frontend y API
echo ==========================================================
echo       INICIANDO CARTILLA DIGITAL
echo ==========================================================
echo.
cd /d "%~dp0"
echo Abriendo http://localhost:5500/
start "" cmd /c "timeout /t 3 /nobreak >nul && start \"\" \"http://localhost:5500/\""
npm start
if errorlevel 1 (
    echo.
    echo [ERROR] No se pudo iniciar Cartilla Digital.
    echo Ejecuta npm install en la raiz y npm install en la carpeta server si faltan dependencias.
    echo.
    pause
)
