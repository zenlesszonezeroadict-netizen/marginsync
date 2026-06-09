# ==============================================================================
# MarginSync — Deployment Pre-Flight Check
# ==============================================================================
# Run from project root:  .\deploy-check.ps1
# Requires: Vercel CLI (npm i -g vercel)
# ==============================================================================

$ErrorActionPreference = 'Continue'
$script:allPassed = $true
$script:failCount = 0

function Write-Check {
    param(
        [string]$Label,
        [bool]$Passed,
        [string]$Fix = ''
    )
    if ($Passed) {
        Write-Host "  [PASS] $Label" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] $Label" -ForegroundColor Red
        if ($Fix) {
            Write-Host "         FIX: $Fix" -ForegroundColor Yellow
        }
        $script:allPassed = $false
        $script:failCount++
    }
}

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "-- $Title" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  MarginSync — Vercel Deployment Pre-Flight Check" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# ==============================================================================
# BLOCK 1: Vercel CLI presence + auth
# ==============================================================================
Write-Section "1. Vercel CLI"

$vercelVersion = vercel --version 2>&1
$cliInstalled = ($LASTEXITCODE -eq 0)
Write-Check "Vercel CLI installed ($vercelVersion)" $cliInstalled `
    "npm install -g vercel"

if ($cliInstalled) {
    $whoami = vercel whoami 2>&1
    $loggedIn = ($LASTEXITCODE -eq 0)
    Write-Check "Authenticated as: $whoami" $loggedIn `
        "vercel login"
}

# ==============================================================================
# BLOCK 2: Project link (.vercel/project.json)
# ==============================================================================
Write-Section "2. Project Link"

$projectJsonPath = ".vercel\project.json"
$isLinked = Test-Path $projectJsonPath
Write-Check ".vercel/project.json exists" $isLinked `
    "vercel link  (select your existing Vercel project or create new)"

if ($isLinked) {
    try {
        $proj = Get-Content $projectJsonPath -Raw | ConvertFrom-Json
        Write-Check "projectId is set  ($($proj.projectId))" `
            (-not [string]::IsNullOrWhiteSpace($proj.projectId)) `
            "Re-run: vercel link"
        Write-Check "orgId is set      ($($proj.orgId))" `
            (-not [string]::IsNullOrWhiteSpace($proj.orgId)) `
            "Re-run: vercel link"
    } catch {
        Write-Check "project.json is valid JSON" $false `
            "Delete .vercel\ and re-run: vercel link"
    }
}

# ==============================================================================
# BLOCK 3: All required env vars present in Vercel Production
# ==============================================================================
Write-Section "3. Vercel Production Environment Variables"

$requiredVars = @(
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRO_PRICE_ID",
    "SHOPIFY_API_KEY",
    "SHOPIFY_API_SECRET",
    "SHOPIFY_SCOPES",
    "TOKEN_ENCRYPTION_KEY",
    "NEXT_PUBLIC_APP_URL"
)

$vercelEnvRaw = vercel env ls production 2>&1 | Out-String

if ($LASTEXITCODE -ne 0) {
    Write-Host "  [WARN] Could not fetch Vercel env vars. Are you linked and logged in?" -ForegroundColor Yellow
} else {
    foreach ($var in $requiredVars) {
        $found = $vercelEnvRaw -match [regex]::Escape($var)
        Write-Check "$var" $found `
            "vercel env add $var production"
    }
}

# ==============================================================================
# BLOCK 4: Critical value checks (pulled locally, deleted after check)
# ==============================================================================
Write-Section "4. Critical Value Checks"

$tempEnvFile = ".env.deploy-check-temp"

# Pull production env vars to a temp file for value inspection
$pullOutput = vercel env pull $tempEnvFile --environment production 2>&1
$pullSucceeded = (Test-Path $tempEnvFile)

if ($pullSucceeded) {
    $envLines = Get-Content $tempEnvFile

    # Check NEXT_PUBLIC_APP_URL is set to production domain (not localhost)
    $appUrlLine = $envLines | Where-Object { $_ -match "^NEXT_PUBLIC_APP_URL=" }
    if ($appUrlLine) {
        $appUrlValue = ($appUrlLine -split "=", 2)[1].Trim().Trim('"')
        $isProductionUrl = $appUrlValue -match "^https://" -and $appUrlValue -notmatch "localhost"
        Write-Check "NEXT_PUBLIC_APP_URL is a production HTTPS URL  ($appUrlValue)" $isProductionUrl `
            "In Vercel Dashboard > Settings > Env Vars: set NEXT_PUBLIC_APP_URL = https://marginsync.vercel.app"
    } else {
        Write-Check "NEXT_PUBLIC_APP_URL is present and readable" $false `
            "vercel env add NEXT_PUBLIC_APP_URL production"
    }

    # Check STRIPE_SECRET_KEY is live key, not test key
    $stripeLine = $envLines | Where-Object { $_ -match "^STRIPE_SECRET_KEY=" }
    if ($stripeLine) {
        $stripeValue = ($stripeLine -split "=", 2)[1].Trim().Trim('"')
        $isLiveKey = $stripeValue -match "^sk_live_"
        $isTestKey = $stripeValue -match "^sk_test_"
        if ($isLiveKey) {
            Write-Check "STRIPE_SECRET_KEY is a LIVE key (sk_live_...)" $true
        } elseif ($isTestKey) {
            Write-Host "  [WARN] STRIPE_SECRET_KEY is a TEST key (sk_test_...) — OK for staging, not for real payments" -ForegroundColor Yellow
        } else {
            Write-Check "STRIPE_SECRET_KEY looks valid" ($stripeValue.Length -gt 10) `
                "Check your Stripe Dashboard > Developers > API Keys"
        }
    }

    # Check TOKEN_ENCRYPTION_KEY is exactly 64 hex chars
    $tokenLine = $envLines | Where-Object { $_ -match "^TOKEN_ENCRYPTION_KEY=" }
    if ($tokenLine) {
        $tokenValue = ($tokenLine -split "=", 2)[1].Trim().Trim('"')
        $is64Hex = $tokenValue -match "^[0-9a-fA-F]{64}$"
        Write-Check "TOKEN_ENCRYPTION_KEY is 64-char hex ($($tokenValue.Length) chars)" $is64Hex `
            "Regenerate: node -e `"console.log(require('crypto').randomBytes(32).toString('hex'))`""
    }

    # Clean up temp file — never leave secrets on disk
    Remove-Item $tempEnvFile -Force
    Write-Host "  [INFO] Temp env file deleted." -ForegroundColor DarkGray

} else {
    Write-Host "  [WARN] Could not pull env vars for value inspection. Skipping value checks." -ForegroundColor Yellow
    Write-Host "         Run manually: vercel env pull --environment production" -ForegroundColor Yellow
}

# ==============================================================================
# BLOCK 5: Final production build
# ==============================================================================
Write-Section "5. Final Production Build (npm run build)"

Write-Host "  Running build — this takes ~15s..." -ForegroundColor DarkGray
$buildOutput = (npm run build 2>&1) | Out-String

$compiledClean  = $buildOutput -match "Compiled successfully"
$noTSErrors     = -not ($buildOutput -match "error TS\d{4}")
$noTypeErrors   = -not ($buildOutput -match "TypeScript.*error|Failed to compile")
$allRoutesOk    = $buildOutput -match "Route \(app\)"

Write-Check "Compiled successfully (Turbopack)"  $compiledClean  "Fix build errors shown above"
Write-Check "Zero TypeScript errors"             ($noTSErrors -and $noTypeErrors) "Run: npx tsc --noEmit"
Write-Check "Route manifest generated"           $allRoutesOk    "Check for broken Route Handlers"

# ==============================================================================
# SUMMARY
# ==============================================================================
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
if ($script:allPassed) {
    Write-Host "  ALL CHECKS PASSED" -ForegroundColor Green
    Write-Host "  Safe to deploy. Run:" -ForegroundColor Green
    Write-Host ""
    Write-Host "      vercel --prod" -ForegroundColor White
} else {
    Write-Host "  $($script:failCount) CHECK(S) FAILED — fix before deploying" -ForegroundColor Red
    Write-Host "  Resolve all [FAIL] items above, then re-run this script." -ForegroundColor Yellow
}
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
