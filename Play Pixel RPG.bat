@echo off
title Pixel RPG
cd /d "%~dp0"
if not exist node_modules call npm install
node scripts\play.mjs
pause
