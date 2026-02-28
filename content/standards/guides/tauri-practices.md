---
title: "Tauri Practices"
slug: tauri-practices
category: guides
tags: [tauri, desktop, rust, security]
summary: "Development practices for Tauri desktop applications"
author: "eSolia Technical Team"
created: "2025-12-29"
modified: "2026-03-01"
---
# Tauri Desktop Application Practices

> **Central Reference**: Security and best practices for eSolia Tauri applications (Courier desktop).

Tauri enables building desktop apps with web technologies. This guide covers security-first development practices.

## Security Model

Tauri has a multi-layer security model:

```
┌─────────────────────────────────────────────────────────────────┐
│                        TAURI SECURITY LAYERS                    │
├─────────────────────────────────────────────────────────────────┤
│  Rust Core          │  System access, IPC validation           │
│  Allowlist          │  Feature gating (fs, http, shell)        │
│  CSP                │  Content Security Policy for webview     │
│  IPC Commands       │  Frontend ↔ Backend communication        │
│  Capabilities       │  Fine-grained permission system (v2)     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project Configuration

### `tauri.conf.json` Security Settings

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "eSolia Courier",
  "version": "0.1.0",
  "identifier": "co.jp.esolia.courier",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:5175",
    "frontendDist": "../build"
  },
  "app": {
    "withGlobalTauri": false,
    "security": {
      "csp": {
        "default-src": "'self'",
        "script-src": "'self'",
        "style-src": "'self' 'unsafe-inline'",
        "img-src": "'self' data: https:",
        "connect-src": "'self' https://nexus.esolia.co.jp"
      },
      "freezePrototype": true,
      "dangerousDisableAssetCspModification": false
    },
    "windows": [
      {
        "title": "eSolia Courier",
        "width": 1200,
        "height": 800,
        "resizable": true,
        "fullscreen": false,
        "decorations": true
      }
    ]
  },
  "bundle": {
    "active": true,
    "icon": ["icons/icon.png"],
    "macOS": {
      "minimumSystemVersion": "10.15"
    },
    "windows": {
      "webviewInstallMode": { "type": "embedBootstrapper" }
    }
  }
}
```

### Capabilities (Tauri v2)

```json
// src-tauri/capabilities/default.json
{
  "$schema": "https://schema.tauri.app/capabilities/2",
  "identifier": "default",
  "description": "Default capabilities for Courier",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-close",
    "core:window:allow-minimize",
    "core:window:allow-maximize",
    "dialog:allow-open",
    "dialog:allow-save",
    "fs:allow-read",
    "fs:allow-write",
    "http:allow-fetch"
  ],
  "remote": {
    "urls": ["https://nexus.esolia.co.jp/*"]
  }
}
```

---

## IPC Security

### Command Definition (Rust)

```rust
// src-tauri/src/commands.rs
use tauri::command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct ShareRequest {
    recipient_email: String,
    expires_in_days: u32,
    files: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct ShareResponse {
    share_id: String,
    url: String,
}

/// Create a new share via Nexus API.
/// InfoSec: Validates input before API call
#[command]
pub async fn create_share(
    request: ShareRequest,
    state: tauri::State<'_, AppState>,
) -> Result<ShareResponse, String> {
    // Validate input
    if !is_valid_email(&request.recipient_email) {
        return Err("Invalid email address".to_string());
    }

    if request.expires_in_days == 0 || request.expires_in_days > 30 {
        return Err("Expiration must be between 1 and 30 days".to_string());
    }

    if request.files.is_empty() {
        return Err("At least one file required".to_string());
    }

    // Call Nexus API
    let response = state.client
        .post("https://nexus.esolia.co.jp/api/v1/shares")
        .bearer_auth(&state.token)
        .json(&request)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("API error: {}", response.status()));
    }

    let share: ShareResponse = response.json().await.map_err(|e| e.to_string())?;
    Ok(share)
}

fn is_valid_email(email: &str) -> bool {
    // Basic email validation
    email.contains('@') && email.contains('.')
}
```

### Command Registration

```rust
// src-tauri/src/main.rs
mod commands;

fn main() {
    tauri::Builder::default()
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::create_share,
            commands::get_shares,
            commands::upload_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Frontend Invocation (TypeScript)

```typescript
// src/lib/tauri/shares.ts
import { invoke } from '@tauri-apps/api/core';

interface ShareRequest {
  recipient_email: string;
  expires_in_days: number;
  files: string[];
}

interface ShareResponse {
  share_id: string;
  url: string;
}

/**
 * Create a share via Tauri IPC.
 * InfoSec: Input validation happens in Rust backend
 */
export async function createShare(request: ShareRequest): Promise<ShareResponse> {
  try {
    return await invoke<ShareResponse>('create_share', { request });
  } catch (error) {
    throw new Error(`Failed to create share: ${error}`);
  }
}
```

---

## File System Security

### Scoped File Access

```rust
// src-tauri/src/commands.rs
use tauri::api::path::app_data_dir;
use std::path::PathBuf;

/// Get safe path within app data directory.
/// InfoSec: Prevents path traversal attacks
fn get_safe_path(config: &tauri::Config, filename: &str) -> Result<PathBuf, String> {
    let base = app_data_dir(config)
        .ok_or("Failed to get app data directory")?;

    // Sanitize filename - remove path components
    let safe_name = filename
        .replace(['/', '\\', '..'], "")
        .trim()
        .to_string();

    if safe_name.is_empty() {
        return Err("Invalid filename".to_string());
    }

    let path = base.join("uploads").join(&safe_name);

    // Verify path is still within base directory
    if !path.starts_with(&base) {
        return Err("Path traversal detected".to_string());
    }

    Ok(path)
}

#[command]
pub async fn save_file(
    filename: String,
    content: Vec<u8>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let path = get_safe_path(app.config(), &filename)?;

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    std::fs::write(&path, content).map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().to_string())
}
```

### File Type Validation

```rust
/// Validate file type by magic bytes.
/// InfoSec: Don't trust file extensions alone
fn validate_file_type(content: &[u8]) -> Result<String, String> {
    let mime = match &content[..4.min(content.len())] {
        [0x89, 0x50, 0x4E, 0x47] => "image/png",
        [0xFF, 0xD8, 0xFF, ..] => "image/jpeg",
        [0x25, 0x50, 0x44, 0x46] => "application/pdf",
        [0x50, 0x4B, 0x03, 0x04] => "application/zip",
        _ => return Err("Unsupported file type".to_string()),
    };

    Ok(mime.to_string())
}
```

---

## Secure Updates

### Auto-Updater Configuration

```json
// tauri.conf.json
{
  "plugins": {
    "updater": {
      "active": true,
      "pubkey": "YOUR_PUBLIC_KEY_HERE",
      "endpoints": ["https://releases.esolia.co.jp/courier/{{target}}/{{arch}}/{{current_version}}"]
    }
  }
}
```

### Update Signature Verification

```bash
# Generate keypair (once, during setup)
tauri signer generate -w ~/.tauri/courier.key

# Sign releases during build
tauri build --target x86_64-pc-windows-msvc
```

### Update Endpoint Response

```json
{
  "version": "1.0.1",
  "notes": "Bug fixes and security updates",
  "pub_date": "2025-01-15T00:00:00Z",
  "platforms": {
    "darwin-x86_64": {
      "signature": "Content-Signature: ...",
      "url": "https://releases.esolia.co.jp/courier/darwin/x86_64/1.0.1/Courier.app.tar.gz"
    },
    "darwin-aarch64": {
      "signature": "Content-Signature: ...",
      "url": "https://releases.esolia.co.jp/courier/darwin/aarch64/1.0.1/Courier.app.tar.gz"
    },
    "windows-x86_64": {
      "signature": "Content-Signature: ...",
      "url": "https://releases.esolia.co.jp/courier/windows/x86_64/1.0.1/Courier.msi"
    }
  }
}
```

---

## Token Storage

### Secure Credential Storage

```rust
// src-tauri/src/keyring.rs
use keyring::Entry;

const SERVICE_NAME: &str = "esolia-courier";

/// Store token in OS keychain.
/// InfoSec: Uses OS-native secure storage (Keychain, Credential Manager)
pub fn store_token(user_id: &str, token: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, user_id)
        .map_err(|e| e.to_string())?;

    entry.set_password(token)
        .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn get_token(user_id: &str) -> Result<String, String> {
    let entry = Entry::new(SERVICE_NAME, user_id)
        .map_err(|e| e.to_string())?;

    entry.get_password()
        .map_err(|e| e.to_string())
}

pub fn delete_token(user_id: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, user_id)
        .map_err(|e| e.to_string())?;

    entry.delete_credential()
        .map_err(|e| e.to_string())?;

    Ok(())
}
```

### Tauri Command Wrapper

```rust
#[command]
pub async fn login(
    email: String,
    password: String,
) -> Result<LoginResponse, String> {
    // Authenticate with Nexus
    let response = authenticate(&email, &password).await?;

    // Store token securely
    keyring::store_token(&email, &response.token)?;

    Ok(LoginResponse {
        user_id: response.user_id,
        email: email,
    })
}

#[command]
pub async fn logout(email: String) -> Result<(), String> {
    keyring::delete_token(&email)?;
    Ok(())
}
```

---

## Content Security Policy

### Strict CSP for Desktop

```json
{
  "app": {
    "security": {
      "csp": {
        "default-src": "'self'",
        "script-src": "'self'",
        "style-src": "'self' 'unsafe-inline'",
        "img-src": "'self' data: https://nexus.esolia.co.jp",
        "font-src": "'self' https://fonts.gstatic.com",
        "connect-src": "'self' https://nexus.esolia.co.jp https://api.esolia.co.jp",
        "frame-src": "'none'",
        "object-src": "'none'",
        "base-uri": "'self'"
      }
    }
  }
}
```

### Disable Dangerous Features

```json
{
  "app": {
    "security": {
      "freezePrototype": true,
      "dangerousDisableAssetCspModification": false
    },
    "withGlobalTauri": false
  }
}
```

---

## Deep Link Security

### Deep Link Configuration

```json
// tauri.conf.json
{
  "plugins": {
    "deep-link": {
      "desktop": {
        "schemes": ["esolia-courier"]
      }
    }
  }
}
```

### Secure Deep Link Handling

```rust
// src-tauri/src/main.rs
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(any(windows, target_os = "linux"))]
            {
                let handle = app.handle().clone();
                tauri_plugin_deep_link::prepare("esolia-courier");
                tauri_plugin_deep_link::register("esolia-courier", move |request| {
                    handle_deep_link(&handle, request);
                })
                .unwrap();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Handle deep link requests.
/// InfoSec: Validate and sanitize deep link URLs
fn handle_deep_link(app: &tauri::AppHandle, url: String) {
    // Only handle known paths
    if let Ok(parsed) = url::Url::parse(&url) {
        match parsed.path() {
            "/auth/callback" => {
                // Handle OAuth callback
                if let Some(code) = parsed.query_pairs().find(|(k, _)| k == "code") {
                    // Validate code format before using
                    if is_valid_auth_code(&code.1) {
                        app.emit_all("auth-callback", code.1.to_string()).ok();
                    }
                }
            }
            "/share" => {
                // Handle share deep link
                if let Some(id) = parsed.query_pairs().find(|(k, _)| k == "id") {
                    if is_valid_share_id(&id.1) {
                        app.emit_all("open-share", id.1.to_string()).ok();
                    }
                }
            }
            _ => {
                // Log unknown deep links for security monitoring
                eprintln!("Unknown deep link path: {}", parsed.path());
            }
        }
    }
}
```

---

## Build and Distribution

### Code Signing (macOS)

```bash
# Set up signing identity
export APPLE_SIGNING_IDENTITY="Developer ID Application: eSolia Inc (XXXXXXXXXX)"

# Build with signing
npm run tauri build -- --target universal-apple-darwin

# Notarize
xcrun notarytool submit \
  target/universal-apple-darwin/release/bundle/macos/Courier.app.zip \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait
```

### Code Signing (Windows)

```powershell
# Sign with certificate
signtool sign /f certificate.pfx /p $PASSWORD /tr http://timestamp.digicert.com /td sha256 /fd sha256 "Courier.exe"
```

### GitHub Actions CI/CD

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        include:
          - platform: macos-latest
            target: universal-apple-darwin
          - platform: windows-latest
            target: x86_64-pc-windows-msvc
          - platform: ubuntu-latest
            target: x86_64-unknown-linux-gnu

    runs-on: ${{ matrix.platform }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Rust
        uses: dtolnay/rust-action@stable

      - name: Install dependencies
        run: npm ci

      - name: Build Tauri
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: v__VERSION__
          releaseName: 'Courier v__VERSION__'
          releaseBody: 'See changelog for details.'
          releaseDraft: true
          prerelease: false
```

---

## Security Checklist

### Before Release

- [ ] CSP configured restrictively
- [ ] All IPC commands validate input
- [ ] File operations use path sanitization
- [ ] Tokens stored in OS keychain
- [ ] Auto-updater uses signed updates
- [ ] Deep links validated
- [ ] Code signed for distribution
- [ ] Dependencies audited

### IPC Commands

- [ ] Input validation in Rust (not just frontend)
- [ ] Error messages don't leak sensitive info
- [ ] Rate limiting on sensitive commands
- [ ] Logging for security events

### File System

- [ ] Path traversal prevented
- [ ] File type validated by magic bytes
- [ ] File size limits enforced
- [ ] Temp files cleaned up

---

## Resources

- [Tauri Security Documentation](https://tauri.app/v1/guides/security/)
- [Tauri v2 Capabilities](https://tauri.app/v2/guides/capabilities/)
- [Rust Security Guidelines](https://anssi-fr.github.io/rust-security/)

---

**Document Version:** 1.0
**Last Updated:** December 2025
