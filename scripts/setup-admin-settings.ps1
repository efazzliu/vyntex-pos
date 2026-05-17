# One-shot setup: migration 026 + admin-settings edge function secrets + deploy.
# Migrations 023-025 (site users, ban, moderate): run once in SQL Editor if not applied yet.
# Prerequisite: npx supabase login   (once, opens browser)
# Usage:    .\scripts\setup-admin-settings.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Read-DotEnv([string]$path) {
  $out = @{}
  if (-not (Test-Path $path)) { return $out }
  Get-Content $path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $i = $line.IndexOf("=")
    if ($i -lt 1) { return }
    $k = $line.Substring(0, $i).Trim()
    $v = $line.Substring($i + 1).Trim().Trim('"').Trim("'")
    $out[$k] = $v
  }
  return $out
}

function Merge-Env {
  $merged = @{}
  foreach ($f in @(".env", ".env.local", ".env.production", ".env.production.local")) {
    $p = Join-Path $Root $f
    (Read-DotEnv $p).GetEnumerator() | ForEach-Object { $merged[$_.Key] = $_.Value }
  }
  return $merged
}

Write-Host "`n=== Vyntex: Admin Settings Supabase setup ===`n" -ForegroundColor Cyan

# Check CLI login (stderr from supabase is not a hard failure)
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$null = npx supabase projects list 2>&1
$ErrorActionPreference = $prevEap
if ($LASTEXITCODE -ne 0) {
  Write-Host "Not logged in to Supabase CLI." -ForegroundColor Yellow
  Write-Host "Run this first (browser will open):`n  npx supabase login`n"
  Write-Host "Then run again:`n  .\scripts\setup-admin-settings.ps1`n"
  exit 1
}

$envVars = Merge-Env
$url = $envVars["VITE_SUPABASE_URL"]
if (-not $url) {
  Write-Host "Missing VITE_SUPABASE_URL in .env" -ForegroundColor Red
  exit 1
}
$ref = ($url -replace "https://", "" -replace ".supabase.co.*", "").Trim()
Write-Host "Project ref: $ref"

$linkedRef = $null
$refFile = "supabase\.temp\project-ref"
if (Test-Path $refFile) { $linkedRef = (Get-Content $refFile -Raw).Trim() }
if ($linkedRef -ne $ref) {
  Write-Host "Linking project $ref ..."
  $ErrorActionPreference = "Continue"
  npx supabase link --project-ref $ref
  $ErrorActionPreference = $prevEap
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Link failed. Run manually: npx supabase link --project-ref $ref" -ForegroundColor Red
    exit $LASTEXITCODE
  }
}

Write-Host "`n[1/3] Applying migration 026 (admin-avatars storage)..."
npx supabase db query --linked -f "supabase/migrations/026_admin_avatars_storage.sql"
if ($LASTEXITCODE -ne 0) {
  Write-Host "Migration failed. You can paste the same SQL in Dashboard -> SQL Editor." -ForegroundColor Yellow
}

$adminEmails = $envVars["VITE_PLATFORM_ADMIN_EMAILS"]
if (-not $adminEmails) {
  Write-Host "Missing VITE_PLATFORM_ADMIN_EMAILS in .env (must match your Supabase login email)." -ForegroundColor Red
  exit 1
}

Write-Host "`n[2/3] Setting edge function secrets..."
npx supabase secrets set "PLATFORM_ADMIN_EMAILS=$adminEmails"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$resendKey = $envVars["RESEND_API_KEY"]
$resendFrom = $envVars["RESEND_FROM_EMAIL"]
if ($resendKey -and $resendFrom) {
  npx supabase secrets set "RESEND_API_KEY=$resendKey"
  npx supabase secrets set "RESEND_FROM_EMAIL=$resendFrom"
  Write-Host "Resend secrets set from .env"
} else {
  Write-Host "RESEND_API_KEY / RESEND_FROM_EMAIL not in .env - email alerts stay off until you add:" -ForegroundColor Yellow
  Write-Host "  npx supabase secrets set RESEND_API_KEY=re_..."
  Write-Host "  npx supabase secrets set RESEND_FROM_EMAIL=you@yourdomain.com"
}

Write-Host "`n[3/3] Deploying admin-settings function..."
npx supabase functions deploy admin-settings
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nDone. Manual step (Dashboard only):" -ForegroundColor Green
Write-Host "  Authentication -> MFA -> enable TOTP / Authenticator app"
Write-Host "`nThen refresh /admin/settings in the app.`n"
