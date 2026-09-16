# Script de Generación de Zip con Entradas POSIX (v0.2.9)
$zipName = "politica-canon-v0.2.9.zip"
$rootDir = "politica-canon-v0.2.9"

if (Test-Path $zipName) {
    Remove-Item $zipName -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipStream = [System.IO.File]::OpenWrite((Join-Path (Get-Location) $zipName))
$archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)

$cwd = (Get-Location).Path.TrimEnd('\')

$files = Get-ChildItem -Recurse -File | Where-Object { 
    $_.FullName -notmatch '\\\.git' -and 
    $_.FullName -notmatch '\\node_modules' -and
    $_.FullName -notmatch '\\dist' -and
    $_.Name -notmatch '\.zip$'
}

foreach ($file in $files) {
    $relativePath = $file.FullName.Substring($cwd.Length + 1)
    $entryPath = "$rootDir/" + ($relativePath -replace '\\', '/')
    $entry = $archive.CreateEntry($entryPath, [System.IO.Compression.CompressionLevel]::Optimal)
    $entryStream = $entry.Open()
    $fileStream = [System.IO.File]::OpenRead($file.FullName)
    $fileStream.CopyTo($entryStream)
    $fileStream.Close()
    $entryStream.Close()
}

$archive.Dispose()
$zipStream.Close()

Write-Host "ZIP v0.2.9 creado exitosamente con separadores POSIX '/': $zipName"
$hash = (Get-FileHash -Algorithm SHA256 $zipName).Hash
$bytes = (Get-Item $zipName).Length
Write-Host "Tamaño observado: $bytes bytes"
Write-Host "SHA-256 observado: $hash"
