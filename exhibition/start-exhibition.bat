@echo off
rem Gleniff exhibition: opens the projector window, the big screen and the kiosk in Chrome, one per display.
rem 1. Set SITE to the website's address (GitHub Pages).
rem 2. Set the X positions to where each display starts: Windows Settings > System > Display shows the order.
rem    With three 1920-wide displays left to right (kiosk, projector, big screen) the values below are right.
rem 3. Double-click this file. If a window lands on the wrong display, drag it across and press F.

set SITE=https://raymondmcnally.github.io/Gleniff-Exhibition
set KIOSK_X=0
set PROJECTOR_X=1920
set BIGSCREEN_X=3840

set CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe
rem A separate Chrome profile just for the exhibition: calibrate the projector in this profile (kiosk staff panel > Calibrate).
set PROFILE=%LOCALAPPDATA%\GleniffExhibition

start "" "%CHROME%" --user-data-dir="%PROFILE%" --no-first-run --no-default-browser-check --autoplay-policy=no-user-gesture-required --disable-pinch --overscroll-history-navigation=0 --disable-session-crashed-bubble --window-position=%PROJECTOR_X%,0 --window-size=1920,1080 --start-fullscreen --app="%SITE%/project.html?out"
timeout /t 4 >nul
start "" "%CHROME%" --user-data-dir="%PROFILE%" --window-position=%BIGSCREEN_X%,0 --window-size=1920,1080 --start-fullscreen --app="%SITE%/sections.html?display&site=gleniff"
timeout /t 4 >nul
start "" "%CHROME%" --user-data-dir="%PROFILE%" --window-position=%KIOSK_X%,0 --window-size=1920,1080 --start-fullscreen --app="%SITE%/kiosk.html"
