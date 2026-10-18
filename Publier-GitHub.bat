@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================================
echo   Publication de LuminaMC Launcher sur GitHub
echo ========================================================
echo.
set /p REPO_URL="Collez l'URL de votre depot GitHub (ex: https://github.com/pseudo/lumina-mc-launcher.git) : "
if "%REPO_URL%"=="" (
  echo Aucune URL fournie. Annulation.
  pause
  exit /b 1
)
git branch -M main
git remote remove origin 2>nul
git remote add origin %REPO_URL%
git add .
git commit -m "feat: release LuminaMC Launcher v1.0.0" 2>nul
echo.
echo Envoi des fichiers vers GitHub (branche main)...
git push -u origin main
echo.
echo Termine ! Votre code est en ligne sur GitHub.
pause
