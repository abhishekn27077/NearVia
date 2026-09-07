Set-Location -Path "d:\NearVia"
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Starting NEARVIA Full Platform (Backend API + Web Client)..." -ForegroundColor Green
Write-Host "Backend API  : http://localhost:4000" -ForegroundColor Cyan
Write-Host "Frontend Web : http://localhost:3000" -ForegroundColor Emerald
Write-Host "============================================================" -ForegroundColor Cyan
npm run dev
