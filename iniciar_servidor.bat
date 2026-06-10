@echo off
title Servidor - Cartilla Digital
echo ==========================================================
echo       INICIANDO SERVIDOR - CARTILLA DIGITAL
echo ==========================================================
echo.
cd /d "%~dp0\server"
npm start
if errorlevel 1 (
    echo.
    echo [ERROR] No se pudo iniciar el servidor. 
    echo Asegúrate de tener Node.js instalado y haber ejecutado 'npm install' en la carpeta '/server'.
    echo.
    pause
)
