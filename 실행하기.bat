@echo off
chcp 65001 >nul
title 목지키미 개발 서버
echo ====================================================
echo   🌿 목지키미 (Mokjikimi) 스터디룸 서버를 시작합니다
echo   접속 주소: http://localhost:3001
echo ====================================================
cd /d "%~dp0"
start http://localhost:3001
call npm.cmd run dev
pause
