@echo off
title Cherry Studio - Windows Development Scripts
color 0A

:menu
cls
echo.
echo ======================================
echo    Cherry Studio - Windows Dev Menu
echo ======================================
echo.
echo 1. Install Dependencies
echo 2. Start Development Mode
echo 3. Start Debug Mode
echo 4. Build for Windows x64
echo 5. Build for Windows ARM64
echo 6. Build (Unpack - No Installer)
echo 7. Run Tests
echo 8. Code Format & Lint
echo 9. Type Check
echo 0. Exit
echo.
set /p choice="Please select an option (0-9): "

if "%choice%"=="1" goto install
if "%choice%"=="2" goto dev
if "%choice%"=="3" goto debug
if "%choice%"=="4" goto build_win_x64
if "%choice%"=="5" goto build_win_arm64
if "%choice%"=="6" goto build_unpack
if "%choice%"=="7" goto test
if "%choice%"=="8" goto format
if "%choice%"=="9" goto typecheck
if "%choice%"=="0" goto exit
goto menu

:install
echo Installing dependencies...
npm install
pause
goto menu

:dev
echo Starting development mode...
npm run dev
pause
goto menu

:debug
echo Starting debug mode...
npm run debug
pause
goto menu

:build_win_x64
echo Building Windows x64 version...
npm run build:win:x64
pause
goto menu

:build_win_arm64
echo Building Windows ARM64 version...
npm run build:win:arm64
pause
goto menu

:build_unpack
echo Building (unpack mode)...
npm run build:unpack
pause
goto menu

:test
echo Running tests...
npm run test
pause
goto menu

:format
echo Formatting and linting code...
npm run format
npm run lint
pause
goto menu

:typecheck
echo Running type check...
npm run typecheck
pause
goto menu

:exit
echo Goodbye!
exit 