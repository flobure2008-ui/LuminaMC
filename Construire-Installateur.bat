@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================================
echo   Construction de l'installateur Windows LuminaMC (.exe)
echo ========================================================
call npm run dist
echo.
echo Termine ! Votre installateur se trouve dans le dossier "release\".
pause
