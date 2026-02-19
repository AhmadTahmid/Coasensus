param(
  [Parameter(Mandatory = $true)]
  [string]$Name
)

if (-not (Test-Path ".git")) {
  Write-Error "This folder is not a git repository. Run 'git init' first."
  exit 1
}

$branch = "agent/$Name"
git checkout main
git checkout -b $branch
Write-Host "Created and switched to branch: $branch"

