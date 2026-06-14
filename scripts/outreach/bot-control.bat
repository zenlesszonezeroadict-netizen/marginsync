@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM  MarginSync Outreach Bot — Control Panel
REM  Double-click this file any time to check on the bot, start it, or stop it.
REM ─────────────────────────────────────────────────────────────────────────────
title MarginSync Bot - Control Panel
cd /d "%~dp0"

:menu
cls
echo ==================================================
echo      MarginSync Outreach Bot - Control Panel
echo ==================================================
echo.

REM --- Is the bot running? (its single-instance lock listens on port 49321) ---
netstat -ano | findstr "49321" | findstr /i "LISTENING" >nul 2>&1
if %errorlevel%==0 (
  echo    STATUS:   [ RUNNING ]
) else (
  echo    STATUS:   [ STOPPED ]   ^<-- press 1 to start it
)
echo.

REM --- Today's send count ---
powershell -NoProfile -Command "if(Test-Path 'daily-state.json'){$d=Get-Content 'daily-state.json' -Raw|ConvertFrom-Json; Write-Host ('    Today:    '+$d.sent+' emails sent ('+$d.date+')')}else{Write-Host '    Today:    no sends yet'}"

REM --- Queue snapshot ---
powershell -NoProfile -Command "if(Test-Path 'queue.json'){$q=Get-Content 'queue.json' -Raw|ConvertFrom-Json; $p=@($q|Where-Object{$_.status -eq 'pending'}).Count; $s=@($q|Where-Object{$_.status -eq 'sent'}).Count; Write-Host ('    Queue:    '+$p+' pending, '+$s+' sent')}"

REM --- Suppression / bounce count ---
powershell -NoProfile -Command "if(Test-Path 'optout.json'){$o=Get-Content 'optout.json' -Raw|ConvertFrom-Json; Write-Host ('    Blocked:  '+@($o).Count+' addresses (opt-outs + bounces)')}"
echo.
echo    Recent activity:
powershell -NoProfile -Command "if(Test-Path 'run.log'){Get-Content 'run.log' -Tail 6 | ForEach-Object { '      ' + $_ }}else{Write-Host '      (no log yet)'}"
echo.
echo --------------------------------------------------
echo    [1] Start / restart the bot
echo    [2] Open live log window  (keep it open to watch)
echo    [3] Refresh this screen
echo    [4] Stop the bot
echo    [Q] Quit this panel  (bot keeps running)
echo --------------------------------------------------
set /p choice="    Choose and press Enter: "

if /i "%choice%"=="1" goto start
if /i "%choice%"=="2" goto watch
if /i "%choice%"=="3" goto menu
if /i "%choice%"=="4" goto stop
if /i "%choice%"=="Q" exit
goto menu

:start
echo.
echo    Launching the bot (minimized)...
start "MarginSync Bot" /min cmd /c run.bat
echo    Waiting a few seconds for it to come up...
timeout /t 6 /nobreak >nul
goto menu

:watch
REM Open the live log in its own window so this panel stays usable.
start "MarginSync Bot - Live Log" powershell -NoProfile -Command "Write-Host 'Live bot activity - leave this window open. Closing it does NOT stop the bot.'; Write-Host ''; Get-Content 'run.log' -Tail 30 -Wait"
goto menu

:stop
echo.
echo    Stopping the bot...
REM Kill the auto-restart loop first so node cannot relaunch...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'cmd.exe' -and $_.CommandLine -like '*run.bat*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
REM ...then the bot process itself.
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*outreach*bot.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
timeout /t 2 /nobreak >nul
echo    Stopped.
timeout /t 1 /nobreak >nul
goto menu
