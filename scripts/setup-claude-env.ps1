# setup-claude-env.ps1
#
# Bootstrap a consuming repo with eSolia Claude Code rules, commands,
# and MCP config from the codex repository.
#
# Usage:
#   & /path/to/codex/scripts/setup-claude-env.ps1 [-TargetRepo <path>]
#
# Requires: Windows Developer Mode enabled (for symlink creation without admin)

param(
    [string]$TargetRepo = "."
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$CodexRoot = Split-Path -Parent $ScriptDir
$ConfigDir = Join-Path $CodexRoot "config\claude"

$TargetRepo = Resolve-Path $TargetRepo

Write-Host "=== eSolia Claude Code Environment Setup ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Codex root:  $CodexRoot"
Write-Host "  Target repo: $TargetRepo"
Write-Host ""

# ── Verify codex config exists ────────────────────────────────────────────────

$RulesDir = Join-Path $ConfigDir "rules"
$CommandsDir = Join-Path $ConfigDir "commands"

if (-not (Test-Path $RulesDir) -or -not (Test-Path $CommandsDir)) {
    Write-Host "ERROR: config\claude\ not found in codex repo at $CodexRoot" -ForegroundColor Red
    Write-Host "       Make sure you're running this from a valid codex checkout."
    exit 1
}

# ── Create .claude directories ────────────────────────────────────────────────

$ClaudeDir = Join-Path $TargetRepo ".claude"
$TargetRulesDir = Join-Path $ClaudeDir "rules"
$TargetCommandsDir = Join-Path $ClaudeDir "commands"

New-Item -ItemType Directory -Force -Path $TargetRulesDir | Out-Null
New-Item -ItemType Directory -Force -Path $TargetCommandsDir | Out-Null

Write-Host "1. Created .claude\{rules,commands} directories"

# ── Symlink rules ─────────────────────────────────────────────────────────────

$RulesLinked = 0
Get-ChildItem -Path $RulesDir -Filter "*.md" | ForEach-Object {
    $RuleFile = $_.FullName
    $RuleName = $_.Name
    $TargetLink = Join-Path $TargetRulesDir $RuleName

    if (Test-Path $TargetLink) {
        $Item = Get-Item $TargetLink
        if ($Item.LinkType -eq "SymbolicLink") {
            Remove-Item $TargetLink
        } else {
            Write-Host "   SKIP: $RuleName (regular file exists, not overwriting)" -ForegroundColor Yellow
            return
        }
    }

    try {
        New-Item -ItemType SymbolicLink -Path $TargetLink -Target $RuleFile | Out-Null
        $script:RulesLinked++
    } catch {
        Write-Host "   WARN: Could not create symlink for $RuleName. Enable Developer Mode or run as admin." -ForegroundColor Yellow
        # Fallback: copy the file
        Copy-Item $RuleFile $TargetLink
        Write-Host "   Copied $RuleName instead (not a symlink)" -ForegroundColor Yellow
        $script:RulesLinked++
    }
}
Write-Host "2. Symlinked $RulesLinked rule(s) from codex"

# ── Symlink commands ──────────────────────────────────────────────────────────

$CmdsLinked = 0
Get-ChildItem -Path $CommandsDir -Filter "*.md" | ForEach-Object {
    $CmdFile = $_.FullName
    $CmdName = $_.Name
    $TargetLink = Join-Path $TargetCommandsDir $CmdName

    if (Test-Path $TargetLink) {
        $Item = Get-Item $TargetLink
        if ($Item.LinkType -eq "SymbolicLink") {
            Remove-Item $TargetLink
        } else {
            Write-Host "   SKIP: $CmdName (regular file exists, not overwriting)" -ForegroundColor Yellow
            return
        }
    }

    try {
        New-Item -ItemType SymbolicLink -Path $TargetLink -Target $CmdFile | Out-Null
        $script:CmdsLinked++
    } catch {
        Write-Host "   WARN: Could not create symlink for $CmdName. Enable Developer Mode or run as admin." -ForegroundColor Yellow
        Copy-Item $CmdFile $TargetLink
        Write-Host "   Copied $CmdName instead (not a symlink)" -ForegroundColor Yellow
        $script:CmdsLinked++
    }
}
Write-Host "3. Symlinked $CmdsLinked command(s) from codex"

# ── Copy MCP config template ─────────────────────────────────────────────────

$McpTemplate = Join-Path $ConfigDir "mcp.json.example"
$McpTarget = Join-Path $TargetRepo ".mcp.json"

if (Test-Path $McpTemplate) {
    if (Test-Path $McpTarget) {
        Write-Host "4. SKIP: .mcp.json already exists (not overwriting)" -ForegroundColor Yellow
    } else {
        Copy-Item $McpTemplate $McpTarget
        Write-Host "4. Copied .mcp.json template"
    }
} else {
    Write-Host "4. SKIP: No mcp.json.example template found" -ForegroundColor Yellow
}

# ── Print next steps ──────────────────────────────────────────────────────────

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host ""
Write-Host "  1. Register the MCP server (user-scoped, works from any repo):"
Write-Host "     claude mcp add esolia-standards --transport http -s user ``"
Write-Host "       --url https://esolia-standards-mcp.esolia.workers.dev/mcp"
Write-Host ""
Write-Host "  2. Or copy .mcp.json to your project root for project-scoped config"
Write-Host ""
Write-Host "  3. Add .claude\rules\ and .claude\commands\ to .gitignore if"
Write-Host "     symlinks shouldn't be committed (they point to your local codex)"
Write-Host ""
Write-Host "  4. Verify: start a Claude Code session and run /backpressure-review"
Write-Host ""
