# Arranca backend (FastAPI) y frontend (Vite) juntos en Windows.
# Uso:  powershell -ExecutionPolicy Bypass -File start.ps1
$root = $PSScriptRoot

Write-Host "Arrancando backend (http://localhost:8000)..." -ForegroundColor Cyan
$backend = Start-Process -FilePath "$root\backend\venv\Scripts\python.exe" `
  -ArgumentList "-m","uvicorn","app.main:app","--host","127.0.0.1","--port","8000" `
  -WorkingDirectory "$root\backend" -PassThru

Start-Sleep -Seconds 2

Write-Host "Arrancando frontend (http://localhost:5173)..." -ForegroundColor Cyan
$frontend = Start-Process -FilePath "cmd.exe" `
  -ArgumentList "/c","npm","run","dev","--","--port","5173" `
  -WorkingDirectory "$root\frontend" -PassThru

Write-Host ""
Write-Host "CurvaLab en marcha:" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:5173"
Write-Host "  Backend:  http://localhost:8000/docs (documentacion API)"
Write-Host ""
Write-Host "Cierra esta ventana o pulsa Ctrl+C para detener ambos servidores."

try {
  Wait-Process -Id $frontend.Id
} finally {
  Stop-Process -Id $backend.Id -ErrorAction SilentlyContinue
  Stop-Process -Id $frontend.Id -ErrorAction SilentlyContinue
}
