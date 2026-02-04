# eSolia Typora Theme Installer for Windows
# Run: .\install-windows.ps1
# Or right-click and "Run with PowerShell"

Write-Host "🎨 Installing eSolia Typora Theme..." -ForegroundColor Cyan

# Define theme directory
$ThemeDir = "$env:APPDATA\Typora\themes"

# Check if Typora theme folder exists
if (-not (Test-Path $ThemeDir)) {
    Write-Host "⚠️  Typora theme folder not found." -ForegroundColor Yellow
    Write-Host "   Please ensure Typora is installed and has been run at least once."
    Write-Host "   Expected location: $ThemeDir"

    # Try to create the directory
    $CreateDir = Read-Host "Would you like to create the directory? (y/n)"
    if ($CreateDir -eq 'y') {
        New-Item -ItemType Directory -Path $ThemeDir -Force | Out-Null
        Write-Host "   Directory created." -ForegroundColor Green
    } else {
        exit 1
    }
}

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Copy theme files
Write-Host "📁 Copying theme files..." -ForegroundColor White

# Copy CSS file
Copy-Item "$ScriptDir\esolia.css" -Destination $ThemeDir -Force

# Copy assets folder
$AssetsSource = "$ScriptDir\esolia"
$AssetsDestination = "$ThemeDir\esolia"

if (Test-Path $AssetsDestination) {
    Remove-Item -Recurse -Force $AssetsDestination
}
Copy-Item -Recurse $AssetsSource -Destination $ThemeDir -Force

Write-Host "✅ Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Restart Typora"
Write-Host "2. Go to Themes menu and select 'eSolia'"
Write-Host ""
Write-Host "Theme installed to: $ThemeDir" -ForegroundColor Gray

# Keep window open
Write-Host ""
Read-Host "Press Enter to close"
