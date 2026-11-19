@echo off
REM 启动后端（Express，端口 3001）到独立窗口，窗口关掉即停止
cd /d "%~dp0"
title huimeng server :3001
set "PATH=C:\Program Files\nodejs;%PATH%"
if not exist "server\.env" if exist "server\.env.example" copy /y "server\.env.example" "server\.env" >nul
echo [start-backend] node %~dp0server\index.js
node "%~dp0server\index.js"
echo.
echo [start-backend] 后端已退出 (code=%ERRORLEVEL%)，按任意键关闭窗口
pause >nul
