# Crea la tarea programada de Windows que ejecuta el scraper (lunes y jueves a las 8:00).
# Uso (PowerShell, una sola vez):  .\scraper\programar-windows.ps1 -Token "tu-clave-larga"
# El token se guarda como variable de entorno del usuario (no se escribe en el repositorio).
param([Parameter(Mandatory = $true)][string]$Token, [string]$Hora = "08:00")
$raiz = Resolve-Path (Join-Path $PSScriptRoot "..")
[Environment]::SetEnvironmentVariable("INGESTA_TOKEN", $Token, "User")
$accion = New-ScheduledTaskAction -Execute "node" -Argument "scraper\scraper.mjs --portal infocasas --paginas 5 --provincias" -WorkingDirectory $raiz
$disparador = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday, Thursday -At $Hora
Register-ScheduledTask -TaskName "ScraperPropioInfoCasas" -Action $accion -Trigger $disparador -Force | Out-Null
Write-Host "Listo: tarea 'ScraperPropioInfoCasas' creada (lunes y jueves $Hora). El computador debe estar encendido."
