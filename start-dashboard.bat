@echo off
title EBS Aprendiz — Dashboard
cd /d "F:\AIOX PROJECTS\EBS APRENDIZ"

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║    EBS Aprendiz — Dashboard              ║
echo  ║    http://localhost:3000                  ║
echo  ║    Feche esta janela para encerrar.       ║
echo  ╚══════════════════════════════════════════╝
echo.

:: Verificar se o servidor ja esta rodando na porta 3000
netstat -an 2>nul | findstr /C:":3000 " | findstr LISTEN >nul 2>&1
if %errorlevel%==0 (
  echo  Servidor ja rodando — abrindo navegador...
  start "" "http://localhost:3000"
  exit /b 0
)

:: Abrir o navegador apos 2 segundos (em processo separado)
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

:: Iniciar o servidor no primeiro plano (fechar janela = encerrar servidor)
node scripts\dashboard.js

echo.
echo  Servidor encerrado. Pressione qualquer tecla para fechar.
pause >nul
