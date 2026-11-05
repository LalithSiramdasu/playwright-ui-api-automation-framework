# Windows QA Control Center — installer and owner-managed release

**Status:** Windows x64 NSIS installer pipeline. Verification is recorded by the workflow and must be checked for each commit.

## Getting the executable

Open GitHub **Actions → Build Windows QA Control Center installer**. Choose the newest **successful** run matching the expected commit, then download its **qa-control-center-windows-installer** artifact. Extract the ZIP to obtain `QA-Control-Center-Setup-1.0.0-x64.exe` and `SHA256SUMS.txt`.

The installer is deliberately **unsigned**. Windows SmartScreen may identify an unknown publisher. Review the source and SHA-256 checksum; broad public distribution should use authentic Windows code signing. The app targets Windows 10/11 x64.

## What is inside?

- Electron desktop window around the existing local React QA dashboard; no Node access to web content.
- Bundled Node 22 runner and matching Playwright Chromium, Firefox, WebKit browsers, so users do not need to install VS Code, Node or npm.
- The validated local Northline Goods, Sample API and Sample Website fixtures, associated real Playwright tests, and project policy enforcement.
- An HTTP service bound to the local loopback address on an OS-assigned port. Do not expose it to the public internet.
- Local reports and runs saved under Electron's per-user Windows application data folder, outside the read-only installation.

Remote public practice pilots remain disabled from the dashboard. The desktop installer does not add user accounts, hosting, public API access, or mobile automation.

## How the installer is checked

The workflow uses a Windows builder to install locked root dependencies, build React, prepare an allowlisted runtime tree, install three Playwright engines into that tree, build a Windows NSIS installer and run the **packaged runtime** against the real 18-case Sample API suite. It then verifies that each browser executable exists and records the setup file's SHA-256 checksum. The artifact expires after 14 days unless copied into an owner-created release.

That Windows CI smoke is not the same as a person double-clicking the installer and confirming Start Menu shortcuts, closing an active test, uninstall, or Windows Defender warnings. Those are the owner's final local acceptance tests.

## You publish the GitHub Release yourself

1. Download the installer artifact ZIP from the successful workflow, extract the `.exe` and `SHA256SUMS.txt`.
2. Test installing and opening it on your Windows PC; launch a local Sample API test and inspect its HTML report.
3. In your repository open **Releases → Draft a new release**.
4. Create a tag such as `v1.0.0-desktop`; upload the installer and checksum, describe OS support, unsigned status, and scope.
5. Publish the release manually after your own check. **No automation or assistant has published a GitHub Release.**

## Existing history

The desktop app writes history to its own per-user data folder. It does **not** automatically import or delete the existing source-checkout `dashboard/data` folder. To migrate older history later, back up both locations and copy `runs.json` with its `artifacts` directory while the app is closed; never overwrite newer history without preserving a backup.

## Manual build for developers on Windows

Run from the repository root:

```bat
npm ci
npm --prefix dashboard ci
npm run dashboard:build
npm run desktop:prepare
set PLAYWRIGHT_BROWSERS_PATH=%CD%\desktop\build\runtime\browsers
npx playwright install chromium firefox webkit
npm --prefix desktop install
npm --prefix desktop run dist
npm run desktop:smoke
```

Both package installation and browser downloading require internet access during build. The installer is intentionally large because it contains the browser engines.
