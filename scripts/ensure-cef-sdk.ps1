param(
    [string]$Version = "149.0.3+gd84bb73+chromium-149.0.7827.115",
    [string]$Platform = "windows64",
    [string]$Distribution = "minimal",
    [string]$ExpectedSha1 = "17736a1c36482749bc165d1291baa974d270e0ea"
)

$ErrorActionPreference = "Stop"

$thirdPartyRoot = Join-Path (Split-Path -Parent $PSScriptRoot) "third_party\cef"
$packageBaseName = "cef_binary_${Version}_${Platform}_${Distribution}"
$packageFile = Join-Path $thirdPartyRoot "$packageBaseName.tar.bz2"
$sdkRoot = Join-Path $thirdPartyRoot $packageBaseName
$packageUrl = "https://cef-builds.spotifycdn.com/$packageBaseName.tar.bz2"

$headerPath = Join-Path $sdkRoot "include\cef_app.h"
$libPath = Join-Path $sdkRoot "Release\libcef.lib"
$dllPath = Join-Path $sdkRoot "Release\libcef.dll"

if ((Test-Path -LiteralPath $headerPath) -and
    (Test-Path -LiteralPath $libPath) -and
    (Test-Path -LiteralPath $dllPath)) {
    Write-Host "CEF SDK already present at $sdkRoot"
    Write-Output $sdkRoot
    return
}

function Expand-TarArchive {
    param(
        [string]$ArchiveFile,
        [string]$DestinationPath
    )

    $tarCandidates = @(
        "tar.exe",
        "$env:SystemRoot\System32\tar.exe",
        "$env:ProgramFiles\Git\usr\bin\tar.exe",
        "${env:ProgramFiles(x86)}\Git\usr\bin\tar.exe"
    )

    foreach ($candidate in $tarCandidates) {
        $cmd = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($cmd) {
            & $cmd.Source -xf $ArchiveFile -C $DestinationPath
            return
        }
        if (Test-Path -LiteralPath $candidate) {
            & $candidate -xf $ArchiveFile -C $DestinationPath
            return
        }
    }

    $sevenZipCandidates = @(
        "$env:ProgramFiles\7-Zip\7z.exe",
        "${env:ProgramFiles(x86)}\7-Zip\7z.exe"
    )

    foreach ($sz in $sevenZipCandidates) {
        if (Test-Path -LiteralPath $sz) {
            & $sz x $ArchiveFile "-o$DestinationPath" -y | Out-Null
            $tarFile = Join-Path $DestinationPath "$packageBaseName.tar"
            if (Test-Path -LiteralPath $tarFile) {
                & $sz x $tarFile "-o$DestinationPath" -y | Out-Null
                Remove-Item -LiteralPath $tarFile -Force -ErrorAction SilentlyContinue
            }
            return
        }
    }

    throw "No tar extraction tool found (checked System32\tar.exe, Git tar.exe, and 7-Zip). Install 7-Zip or ensure Windows tar.exe is installed."
}

New-Item -ItemType Directory -Force -Path $thirdPartyRoot | Out-Null

if (-not (Test-Path -LiteralPath $packageFile)) {
    Write-Host "Downloading CEF $Version $Platform $Distribution..."
    Invoke-WebRequest -Uri $packageUrl -OutFile $packageFile
}

$actualSha1 = (Get-FileHash -Path $packageFile -Algorithm SHA1).Hash.ToLowerInvariant()
if ($actualSha1 -ne $ExpectedSha1.ToLowerInvariant()) {
    throw "CEF package SHA1 mismatch. Expected $ExpectedSha1, got $actualSha1."
}

if (Test-Path -LiteralPath $sdkRoot) {
    Remove-Item -LiteralPath $sdkRoot -Recurse -Force
}

Write-Host "Extracting CEF package..."
Expand-TarArchive -ArchiveFile $packageFile -DestinationPath $thirdPartyRoot

if (-not ((Test-Path -LiteralPath $headerPath) -and
          (Test-Path -LiteralPath $libPath) -and
          (Test-Path -LiteralPath $dllPath))) {
    throw "CEF package extraction did not contain the expected native files."
}

Write-Host "CEF SDK ready at $sdkRoot"
Write-Output $sdkRoot
