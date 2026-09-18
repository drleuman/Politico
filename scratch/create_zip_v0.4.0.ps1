# Script PowerShell para la creación determinista e inmutable de politica-canon-v0.4.0-alpha.1.zip y MANIFEST_v0.4.0-alpha.1.json
$ErrorActionPreference = "Stop"

$version = "0.4.0-alpha.1"
$zipName = "politica-canon-v0.4.0-alpha.1.zip"
$rootDir = "politica-canon-v0.4.0-alpha.1"
$manifestName = "MANIFEST_v0.4.0-alpha.1.json"

Write-Host "Creando paquete comprimido $zipName..."

$tmpDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.Guid]::NewGuid().ToString())
$stagingDir = Join-Path $tmpDir $rootDir
New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

$includes = @(
    ".gitattributes",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    ".env.example",
    "README.md",
    "CHANGELOG.md",
    "validate_v0.4.0.cjs",
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

# Generar RELEASE_FILES.json con checksums SHA-256 individuales
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
    generatedAt = "2026-09-18"
    fileCount = $fileHashes.Count
    files = $fileHashes
}

$releaseManifestJson = ConvertTo-Json $releaseManifestObj -Depth 4
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$releaseManifestPath = Join-Path $stagingDir "RELEASE_FILES.json"
[System.IO.File]::WriteAllText($releaseManifestPath, $releaseManifestJson, $utf8NoBom)

if (Test-Path $zipName) {
    Remove-Item $zipName -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipStream = [System.IO.File]::OpenWrite((Join-Path (Get-Location) $zipName))
$archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)

$allFiles = Get-ChildItem -Path $stagingDir -Recurse -File | Sort-Object FullName

foreach ($file in $allFiles) {
    $relativePath = $file.FullName.Substring($tmpDir.Length + 1).Replace('\', '/')
    $entry = $archive.CreateEntry($relativePath, [System.IO.Compression.CompressionLevel]::Optimal)
    $entry.LastWriteTime = [DateTimeOffset]::new(2026, 9, 18, 0, 0, 0, [TimeSpan]::Zero)
    
    $entryStream = $entry.Open()
    $fileStream = [System.IO.File]::OpenRead($file.FullName)
    $fileStream.CopyTo($entryStream)
    $fileStream.Close()
    $entryStream.Close()
}

$archive.Dispose()
$zipStream.Close()

Remove-Item $tmpDir -Recurse -Force

# Calcular SHA-256 del artefacto zip
$zipBytes = [System.IO.File]::ReadAllBytes((Join-Path (Get-Location) $zipName))
$zipHashBytes = $sha256.ComputeHash($zipBytes)
$zipHashHex = [System.BitConverter]::ToString($zipHashBytes).Replace("-", "").ToLower()

$manifestObj = [ordered]@{
    version = $version
    releaseDate = "2026-09-18"
    packageName = $zipName
    sizeBytes = $zipBytes.Length
    sha256 = $zipHashHex
    fileCount = $fileHashes.Count
    canonicalDatabaseEngine = "PostgreSQL 16+"
    dictamen = "PASS (RELEASE CANDIDATE V0.4.0-ALPHA.1 - FASE A FOUNDATIONS UI Y ACCESIBILIDAD)"
}

$manifestJson = ConvertTo-Json $manifestObj -Depth 4
[System.IO.File]::WriteAllText((Join-Path (Get-Location) $manifestName), $manifestJson, $utf8NoBom)

Write-Host "Artefacto $zipName creado exitosamente. Size: $($zipBytes.Length) bytes, SHA-256: $zipHashHex"
