@echo off
echo ====================================================
echo Iniciando el Servidor Web del Gestor de Palabras N8N
echo ====================================================

IF NOT EXIST "node_modules" (
    echo [!] Dependencias no encontradas. Instalando...
    npm install
)

echo.
echo Iniciando servidor...
start http://localhost:3000
node server.js
pause
