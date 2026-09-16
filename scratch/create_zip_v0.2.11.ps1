# Script de Generación de Zip y Manifiesto Externo Desacoplado (v0.2.11)
$zipName = "politica-canon-v0.2.11.zip"
$rootDir = "politica-canon-v0.2.11"
$parentZipPath = "..\politica-canon-v0.2.11.zip"
$parentManifestPath = "..\MANIFEST_v0.2.11.json"
$localManifestPath = "MANIFEST_v0.2.11.json"

if (Test-Path $zipName) { Remove-Item $zipName -Force }
if (Test-Path $parentZipPath) { Remove-Item $parentZipPath -Force }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipStream = [System.IO.File]::OpenWrite((Join-Path (Get-Location) $zipName))
$archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)

$cwd = (Get-Location).Path.TrimEnd('\')

$files = Get-ChildItem -Recurse -File | Where-Object { 
    $_.FullName -notmatch '\\\.git' -and 
    $_.FullName -notmatch '\\node_modules' -and
    $_.FullName -notmatch '\\dist' -and
    $_.Name -notmatch '\.zip$' -and
    $_.Name -notmatch '^MANIFEST_'
}

$fileCount = 0
foreach ($file in $files) {
    $relativePath = $file.FullName.Substring($cwd.Length + 1)
    $entryPath = "$rootDir/" + ($relativePath -replace '\\', '/')
    $entry = $archive.CreateEntry($entryPath, [System.IO.Compression.CompressionLevel]::Optimal)
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

Write-Host "ZIP v0.2.11 creado exitosamente con separadores POSIX '/': $zipName"
$hash = (Get-FileHash -Algorithm SHA256 $zipName).Hash.ToLower()
$bytes = (Get-Item $zipName).Length
Write-Host "Archivos dentro del ZIP: $fileCount"
Write-Host "Tamaño observado: $bytes bytes"
Write-Host "SHA-256 observado: $hash"

# Generar el Manifiesto EXTERNO Desacoplado (después del empaquetado del ZIP)
$manifestObject = [PSCustomObject]@{
    version = "0.2.11"
    releaseDate = "2026-09-15"
    packageName = $zipName
    sizeBytes = $bytes
    sha256 = $hash
    fileCount = $fileCount
    canonicalDatabaseEngine = "PostgreSQL 16+"
    dictamen = "PASS (PENDIENTE DE AUDITORÍA EXTERNA FINAL)"
}

$manifestJson = $manifestObject | ConvertTo-Json -Depth 3
Set-Content -Path $localManifestPath -Value $manifestJson -Encoding UTF8
Set-Content -Path $parentManifestPath -Value $manifestJson -Encoding UTF8

Write-Host "Manifiesto externo MANIFEST_v0.2.11.json generado exitosamente fuera del ZIP."
