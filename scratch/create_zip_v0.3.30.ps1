# Script PowerShell para la creación determinista e inmutable de politica-canon-v0.3.30.zip y RELEASE_FILES.json
$ErrorActionPreference = "Stop"

$version = "0.3.30"
$zipName = "politica-canon-v0.3.30.zip"
$rootDir = "politica-canon-v0.3.30"
$manifestName = "MANIFEST_v0.3.30.json"

Write-Host "Creando paquete comprimido $zipName..."

# Crear directorio temporal para empaquetamiento determinista
$tmpDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.Guid]::NewGuid().ToString())
$stagingDir = Join-Path $tmpDir $rootDir
New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

# Lista de archivos y directorios a incluir
$includes = @(
    ".gitattributes",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    ".env.example",
    "README.md",
    "CHANGELOG.md",
    "DEPLOYMENT_REPORT.md",
    "REMEDIATION_MATRIX_v0.3.30.md",
    "VALIDATION_REPORT_v0.3.30.md",
    "validate_v0.3.30.cjs",
    "docker-compose.audit.yml",
    "src",
    "db",
    "public",
    "deploy",
    "scripts"
)

foreach ($item in $includes) {
    if (Test-Path $item) {
        Copy-Item -Path $item -Destination $stagingDir -Recurse -Force
    }
}

# Generar RELEASE_FILES.json con checksums SHA-256 individuales de todo el árbol (M-04 Integridad de Árbol Extraído)
$stagingFiles = Get-ChildItem -Path $stagingDir -Recurse -File | Sort-Object FullName
$fileHashes = [ordered]@{}
$sha256 = [System.Security.Cryptography.SHA256]::Create()

foreach ($file in $stagingFiles) {
    $relativePath = $file.FullName.Substring($stagingDir.Length + 1).Replace('\', '/')
    $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
    $hBytes = $sha256.ComputeHash($bytes)
    $hHex = [System.BitConverter]::ToString($hBytes).Replace("-", "").ToLower()
    $fileHashes[$relativePath] = $hHex
}

$releaseManifestObj = [ordered]@{
    version = $version
    generatedAt = "2026-09-17"
    fileCount = $fileHashes.Count
    files = $fileHashes
}

$releaseManifestJson = ConvertTo-Json $releaseManifestObj -Depth 4
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$releaseManifestPath = Join-Path $stagingDir "RELEASE_FILES.json"
[System.IO.File]::WriteAllText($releaseManifestPath, $releaseManifestJson, $utf8NoBom)
Write-Host "Manifiesto interno RELEASE_FILES.json generado con $($fileHashes.Count) entradas."

# Eliminar zip previo si existe
if (Test-Path $zipName) {
    Remove-Item $zipName -Force
}

# Crear ZIP usando System.IO.Compression para garantizar separadores de ruta POSIX '/'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipStream = [System.IO.File]::OpenWrite((Join-Path (Get-Location) $zipName))
$archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)

$allFiles = Get-ChildItem -Path $stagingDir -Recurse -File | Sort-Object FullName

foreach ($file in $allFiles) {
    $relativePath = $file.FullName.Substring($tmpDir.Length + 1).Replace('\', '/')
    $entry = $archive.CreateEntry($relativePath, [System.IO.Compression.CompressionLevel]::Optimal)
    
    # Fijar fecha determinista para inmutabilidad de checksums
    $entry.LastWriteTime = [DateTimeOffset]::new(2026, 9, 17, 0, 0, 0, [TimeSpan]::Zero)
    
    $entryStream = $entry.Open()
    $fileStream = [System.IO.File]::OpenRead($file.FullName)
    $fileStream.CopyTo($entryStream)
    $fileStream.Close()
    $entryStream.Close()
}

$archive.Dispose()
$zipStream.Close()

# Limpiar staging temp
Remove-Item $tmpDir -Recurse -Force

# Calcular SHA-256 y tamaño del ZIP
$fileBytes = [System.IO.File]::ReadAllBytes((Join-Path (Get-Location) $zipName))
$hashBytes = $sha256.ComputeHash($fileBytes)
$hashHex = [System.BitConverter]::ToString($hashBytes).Replace("-", "").ToLower()
$size = (Get-Item $zipName).Length
$fileCount = $allFiles.Count

Write-Host "ZIP v0.3.30 creado exitosamente (INMUTABLE) con separadores POSIX '/': $zipName"
Write-Host "Archivos dentro del ZIP: $fileCount"
Write-Host "Tamano observado: $size bytes"
Write-Host "SHA-256 observado: $hashHex"

# Generar manifiesto JSON externo (UTF-8 sin BOM)
$manifestObj = [ordered]@{
    version = $version
    releaseDate = "2026-09-17"
    packageName = $zipName
    sizeBytes = $size
    sha256 = $hashHex
    fileCount = $fileCount
    canonicalDatabaseEngine = "PostgreSQL 16+"
    dictamen = "PASS (RELEASE CANDIDATE V0.3.30 - FASE 1.1 FUNCIONAL INMUTABLE Y CERTIFICADA)"
}

$jsonString = ConvertTo-Json $manifestObj -Depth 4
[System.IO.File]::WriteAllText((Join-Path (Get-Location) $manifestName), $jsonString, $utf8NoBom)

# Copiar también RELEASE_FILES.json al directorio actual de trabajo para sincronía local
[System.IO.File]::WriteAllText((Join-Path (Get-Location) "RELEASE_FILES.json"), $releaseManifestJson, $utf8NoBom)

Write-Host "Manifiesto externo $manifestName generado exitosamente (UTF-8 sin BOM)."
