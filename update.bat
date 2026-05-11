@echo off
title EAS Auto Update
cd /d "%~dp0"

echo =========================
echo Adding files...
echo =========================
git add .

echo =========================
echo Commit changes...
echo =========================
set /p msg=Enter commit message: 
if "%msg%"=="" set msg=Update app
git commit -m "%msg%"
if errorlevel 1 (
  echo No commit was created. Continuing to push/update...
)

echo =========================
echo Push to GitHub...
echo =========================
git push

echo =========================
echo Upload Expo Update...
echo =========================
npx.cmd eas update --branch production --message "%msg%"

echo =========================
echo Done Successfully!
echo =========================

pause
