@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM  MarginSync Auto-Editor — double-click to build your video.
REM  Put your raw clips in the  raw  folder first (named 01_, 02_, 03_ ...).
REM ─────────────────────────────────────────────────────────────────────────────
title MarginSync Auto-Editor
cd /d "%~dp0"

where ffmpeg >nul 2>&1
if errorlevel 1 (
  echo.
  echo  ffmpeg was not found. It is required to edit video.
  echo  Install it once by running this in PowerShell:
  echo      winget install Gyan.FFmpeg
  echo.
  pause
  exit /b 1
)

python auto_edit.py
echo.
echo  ------------------------------------------------------------
echo  Opening the output folder...
start "" "%~dp0output"
echo  Done. You can close this window.
pause
