@echo off
title NEARVIA Platform (API + Web + Admin)
cd /d "%~dp0"
echo ============================================================
echo Starting NEARVIA Platform (Backend API + Public Web + Admin)
echo Backend API    : http://localhost:4000
echo Frontend Web   : http://localhost:5173
echo Admin Console  : http://localhost:5174
echo ============================================================
npm run dev
pause
