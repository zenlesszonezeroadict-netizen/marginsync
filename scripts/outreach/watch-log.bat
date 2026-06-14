@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM  MarginSync Bot — Live Log Window
REM  Double-click to watch what the bot is doing in real time.
REM  Leave it open as long as you like. Closing it does NOT stop the bot.
REM ─────────────────────────────────────────────────────────────────────────────
title MarginSync Bot - Live Log
cd /d "%~dp0"
echo Watching the bot's live activity...
echo (You can leave this open. Closing it does NOT affect the bot.)
echo.
powershell -NoProfile -Command "Get-Content 'run.log' -Tail 30 -Wait"
