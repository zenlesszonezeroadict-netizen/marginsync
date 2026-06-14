@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM  Optional: install auto-captioning (Whisper).
REM  Run this ONCE if you want the editor to write captions for you automatically
REM  instead of you typing them into captions.srt by hand.
REM  Note: this downloads a few hundred MB the first time.
REM ─────────────────────────────────────────────────────────────────────────────
title Install Auto-Captions
cd /d "%~dp0"
echo Installing faster-whisper (one-time, downloads a few hundred MB)...
python -m pip install --upgrade pip
python -m pip install faster-whisper
echo.
echo Done. Next time you run make-video.bat it will caption your video automatically.
pause
