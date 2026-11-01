@echo off
title Eradication: old versions
cd /d "%~dp0"
node scripts\old-version.mjs
pause
