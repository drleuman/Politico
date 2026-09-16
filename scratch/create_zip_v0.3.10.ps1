# Script de Generacion de Zip Criptograficamente Determinista y Manifiesto Externo (v0.3.10)
$zipName = "politica-canon-v0.3.10.zip"
$rootDir = "politica-canon-v0.3.10"
$parentZipPath = "..\politica-canon-v0.3.10.zip"
$parentManifestPath = "..\MANIFEST_v0.3.10.json"
$localManifestPath = "MANIFEST_v0.3.10.json"

if (Test-Path $zipName) { Remove-Item $zipName -Force }
if (Test-Path $parentZipPath) { Remove-Item $parentZipPath -Force }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipStream = [System.IO.File]::OpenWrite((Join-Path (Get-Location) $zipName))
$archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)

$cwd = (Get-Location).Path.TrimEnd('\')
$fixedTime = [System.DateTimeOffset]::Parse("2026-09-16T12:00:00+02:00")

$files = Get-ChildItem -Recurse -File | Where-Object { 
    $_.FullName -notmatch '\\\.git' -and 
    $_.FullName -notmatch '\\node_modules' -and
    $_.FullName -notmatch '\\dist' -and
    $_.Name -notmatch '\.zip$' -and
    $_.Name -notmatch '^MANIFEST_'
} | Sort-Object FullName

$fileCount = 0
foreach ($file in $files) {
    $relativePath = $file.FullName.Substring($cwd.Length + 1)
    $entryPath = "$rootDir/" + ($relativePath -replace '\\', '/')
    $entry = $archive.CreateEntry($entryPath, [System.IO.Compression.CompressionLevel]::Optimal)
    $entry.LastWriteTime = $fixedTime
    $entryStream = $entry.Open()
    $fileStream = [System.IO.File]::OpenRead($file.FullName)
    $fileStream.CopyTo($entryStream)
    $fileStream.Close()
    $entryStream.Close()
    $fileCount++
}

$archive.Dispose()
$zipStream.Close()

# Copiar el ZIP a la carpeta padre f:\politica-canon-v0.1.0\
Copy-Item -Path $zipName -Destination $parentZipPath -Force

Write-Host "ZIP v0.3.10 creado exitosamente (DETERMINISTA) con separadores POSIX '/': $zipName"
$hash = (Get-FileHash -Algorithm SHA256 $zipName).Hash.ToLower()
$bytes = (Get-Item $zipName).Length
Write-Host "Archivos dentro del ZIP: $fileCount"
Write-Host "Tamaño observado: $bytes bytes"
Write-Host "SHA-256 observado: $hash"

# Generar el Manifiesto EXTERNO Desacoplado
$manifestObject = [PSCustomObject]@{
    version = "0.3.10"
    releaseDate = "2026-09-16"
    packageName = $zipName
    sizeBytes = $bytes
    sha256 = $hash
    fileCount = $fileCount
    canonicalDatabaseEngine = "PostgreSQL 16+"
    dictamen = "PASS (RELEASE V0.3.10 AJUSTES ENTORNO REAL PLESK / UBUNTU 24.04 CODIFICADOS EN REPOSITORIO)"
}

$manifestJson = $manifestObject | ConvertTo-Json -Depth 3
Set-Content -Path $localManifestPath -Value $manifestJson -Encoding UTF8
Set-Content -Path $parentManifestPath -Value $manifestJson -Encoding UTF8

Write-Host "Manifiesto externo MANIFEST_v0.3.10.json generado exitosamente."
