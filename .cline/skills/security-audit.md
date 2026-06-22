# security-audit

## Purpose
Check token encryption, OAuth state validation, secret leakage, log sanitization, .env safety, IPC exposure, and unsafe file/terminal operations.

## When to Use
Use this skill when:
- touching auth, OAuth, tokens, or credentials
- adding or changing encryption or secret storage logic
- exposing new IPC APIs from preload
- adding logging around errors, requests, or responses
- handling file paths, uploads, or shell commands
- reviewing whether a task introduced new security risk

## Checklist
- [ ] Verify secrets are not hardcoded
- [ ] Verify tokens are encrypted or handled safely at rest
- [ ] Verify OAuth state/nonce validation exists where required
- [ ] Verify logs do not leak tokens, secrets, raw credentials, or unsafe payloads
- [ ] Verify sanitization is applied before logging sensitive objects
- [ ] Verify preload exposes only the minimum required APIs
- [ ] Verify renderer cannot directly access privileged Node/Electron capabilities
- [ ] Verify IPC handlers validate input shape and intent
- [ ] Verify `.env` or config secrets are not committed into source files
- [ ] Verify file operations do not trust unsafe paths blindly
- [ ] Verify terminal/command usage does not inject untrusted input
- [ ] Summarize security findings and residual risk

## Commands to Run
```bash
npx tsc --noEmit
git diff
```

Optional searches:
```bash
findstr /s /n /i "token secret password access_token refresh_token client_secret" src\* electron\* prisma\* docs\*
findstr /s /n /i "ipcRenderer.invoke ipcMain.handle contextBridge.exposeInMainWorld" src\* electron\*
```

## Common Failure Cases
- access tokens logged in plaintext
- secrets embedded in sample or production config files
- preload exposes generic `invoke` or unrestricted Node access
- IPC accepts dangerous file paths or unchecked arguments
- OAuth callback/state validation missing or partial
- raw API error responses contain sensitive fields and are persisted/logged
- shell commands interpolate untrusted strings unsafely
- dev-only shortcuts remain enabled in production paths

## Expected Output / Report Format
```md
## Security Audit Report
### Scope
- auth / IPC / logging / config / file or command handling reviewed

### Verified
- encryption and token handling
- log sanitization
- IPC exposure safety
- config safety

### Findings
- vulnerabilities, leaks, or risky patterns

### Risk Level
- low / medium / high

### Recommendation
- immediate fixes and follow-up items