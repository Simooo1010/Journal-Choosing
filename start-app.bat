@echo off
title Protocollo 7 Vettori
echo =======================================================
echo     Protocollo dei 7 Vettori dell'Intensità
echo =======================================================
echo.
echo [1/2] Avvio del server locale (Vite)...
start /b cmd /c "npm.cmd run dev"
echo.
echo [2/2] Attesa inizializzazione (2s)...
timeout /t 2 /nobreak >nul
echo.
echo [OK] Apertura dell'applicazione nel browser default...
start http://localhost:5173
echo.
echo Per fermare il server, premi CTRL+C in questa finestra.
echo =======================================================
pause
