Set-Location -Path $PSScriptRoot
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Starting NEARVIA Full Platform (Backend API + Web + Admin)..." -ForegroundColor Green
Write-Host "Backend API   : http://localhost:4000" -ForegroundColor Cyan
Write-Host "Frontend Web  : http://localhost:5173" -ForegroundColor Green
Write-Host "Admin Console : http://localhost:5174" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
npm run dev
