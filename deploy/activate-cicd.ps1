# One-shot: activate auto-deploy (run once on your PC in PowerShell)
# Usage: .\deploy\activate-cicd.ps1 -GitHubToken "ghp_xxxx" -VpsPassword "your-root-password"
param(
    [Parameter(Mandatory = $true)][string]$GitHubToken,
    [Parameter(Mandatory = $true)][string]$VpsPassword
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Key = "$env:USERPROFILE\.ssh\crownev_deploy"

if (-not (Test-Path $Key)) {
    ssh-keygen -t ed25519 -C "github-actions-crownev" -f $Key -N '""'
}

Write-Host "==> GitHub secrets"
$env:GITHUB_TOKEN = $GitHubToken
python "$RepoRoot\deploy\_set_github_secrets.py"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> VPS deploy key"
python "$RepoRoot\deploy\_setup_cicd_vps.py" $VpsPassword
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Done. Auto-deploy is live."
Write-Host "Push to main -> https://github.com/SHAHBAZ-084/CROWNEV/actions"
