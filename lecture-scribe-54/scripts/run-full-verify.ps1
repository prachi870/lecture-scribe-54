<#
  run-full-verify.ps1

  Combined verification script for local developer use.
  - Securely prompts for HUGGINGFACE_API_KEY (no echo)
  - Runs scripts/hf-verify.js and writes sanitized JSON to hf-verify-output.json
  - Runs `npm ci` to install dependencies
  - Runs `npx tsc --noEmit` for TypeScript check
  - Optionally starts the dev server (npm run dev)

  Usage:
    In PowerShell (not PS ISE):
      cd <repo-root>
      .\scripts\run-full-verify.ps1

  Security:
  - The script never prints the HF key. It sets it only for child processes and clears it from memory after use.
  - Do not run this in a shared or public environment.
#>

Set-StrictMode -Version Latest

function Clear-SecureEnvVar([string]$name) {
  if (Test-Path Env:\$name) { Remove-Item Env:\$name }
}

Write-Host "\n=== Lecture Scribe: Hugging Face + Build Verification ===\n"

# Ensure Node is available
try {
  $nodeVersion = (node --version) -join '' 2>$null
  if (-not $nodeVersion) { throw }
  Write-Host "Node detected: $nodeVersion" -ForegroundColor Green
} catch {
  Write-Host "Node.js not found in PATH. Please install Node 18+ and retry." -ForegroundColor Red
  exit 20
}

# Securely prompt for HF key
$hfKeySecure = Read-Host -AsSecureString "Enter HUGGINGFACE_API_KEY (will not echo) or press Enter to skip (CI/Secrets)"
$hfKey = $null
if ($hfKeySecure.Length -gt 0) {
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($hfKeySecure)
  try { $hfKey = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  # set for child processes
  $env:HUGGINGFACE_API_KEY = $hfKey
  Write-Host "HUGGINGFACE_API_KEY set for this session (not echoed)." -ForegroundColor Yellow
} else {
  Write-Host "No HF key supplied interactively. Relying on .env or CI secrets if present." -ForegroundColor Yellow
}

# Optional model overrides
if (-not $env:HUGGINGFACE_GENERATE_MODEL) { $env:HUGGINGFACE_GENERATE_MODEL = 'gpt2' }
if (-not $env:HUGGINGFACE_TRANSCRIBE_MODEL) { $env:HUGGINGFACE_TRANSCRIBE_MODEL = 'openai/whisper-small' }
Write-Host "Using HUGGINGFACE_GENERATE_MODEL=$($env:HUGGINGFACE_GENERATE_MODEL), HUGGINGFACE_TRANSCRIBE_MODEL=$($env:HUGGINGFACE_TRANSCRIBE_MODEL)" -ForegroundColor Cyan

# Run HF verify script
$verifyScript = Join-Path -Path (Get-Location) -ChildPath "scripts\hf-verify.js"
if (-not (Test-Path $verifyScript)) {
  Write-Host "Cannot find $verifyScript. Make sure you're running from the repository root." -ForegroundColor Red
  Clear-SecureEnvVar 'HUGGINGFACE_API_KEY'
  exit 21
}

Write-Host "\n1) Running Hugging Face connectivity test (sanitized output will be saved to hf-verify-output.json)" -ForegroundColor Cyan
try {
  $hfOutFile = Join-Path (Get-Location) 'hf-verify-output.json'
  if (Test-Path $hfOutFile) { Remove-Item $hfOutFile -Force }
  # Run node script and capture stdout
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = 'node'
  $psi.ArgumentList = @($verifyScript)
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.UseShellExecute = $false
  $p = [System.Diagnostics.Process]::Start($psi)
  $stdOut = $p.StandardOutput.ReadToEnd()
  $stdErr = $p.StandardError.ReadToEnd()
  $p.WaitForExit()
  if ($stdErr) { Write-Host "HF verify stderr:\n$stdErr" -ForegroundColor Yellow }
  if ($stdOut) {
    # try to parse as JSON for pretty display
    try {
      $json = $stdOut | ConvertFrom-Json -ErrorAction Stop
      $json | ConvertTo-Json -Depth 6 | Out-File -FilePath $hfOutFile -Encoding utf8
      Write-Host "HF verify completed. Sanitized JSON written to: $hfOutFile" -ForegroundColor Green
      Write-Host "Preview:" -ForegroundColor Cyan
      $json | ConvertTo-Json -Depth 3 | Write-Host
    } catch {
      Write-Host "HF verify printed non-JSON output (see raw):\n$stdOut" -ForegroundColor Yellow
      $stdOut | Out-File -FilePath $hfOutFile -Encoding utf8
    }
  } else {
    Write-Host "HF verify produced no stdout. See stderr above." -ForegroundColor Red
  }
} catch {
  Write-Host "HF verify failed: $($_.Exception.Message)" -ForegroundColor Red
  Clear-SecureEnvVar 'HUGGINGFACE_API_KEY'
  exit 22
}

# Install dependencies
Write-Host "\n2) Installing dependencies with npm ci (this may take a while)" -ForegroundColor Cyan
$npmExit = & npm ci
if ($LASTEXITCODE -ne 0) {
  Write-Host "npm ci failed with exit code $LASTEXITCODE" -ForegroundColor Red
  Clear-SecureEnvVar 'HUGGINGFACE_API_KEY'
  exit 30
}
Write-Host "npm ci completed." -ForegroundColor Green

# TypeScript check
Write-Host "\n3) Running TypeScript check (npx tsc --noEmit)" -ForegroundColor Cyan
$npxExit = & npx tsc --noEmit 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "TypeScript check failed. Output:" -ForegroundColor Red
  Write-Host $npxExit
  Clear-SecureEnvVar 'HUGGINGFACE_API_KEY'
  exit 40
}
Write-Host "TypeScript check passed." -ForegroundColor Green

# Ask whether to start dev server
$startDev = Read-Host "Start the dev server now? (Y/N) [N]"
if ($startDev -match '^(y|yes)$') {
  Write-Host "\n4) Starting dev server (npm run dev). Press Ctrl+C to stop." -ForegroundColor Cyan
  try {
    # Start dev server in the same console (interactive)
    & npm run dev
  } catch {
    Write-Host "Failed to start dev server: $($_.Exception.Message)" -ForegroundColor Red
  }
} else {
  Write-Host "Skipping dev server start. You can start it later with: npm run dev" -ForegroundColor Yellow
}

# Clean up sensitive env var
Clear-SecureEnvVar 'HUGGINGFACE_API_KEY'
Write-Host "\nFinished. Remember to unset any keys you set in this shell." -ForegroundColor Green
