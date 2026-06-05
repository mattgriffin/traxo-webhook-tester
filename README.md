# Traxo Webhook Tester

A desktop app for generating and sending test webhook payloads in the Traxo format. Built for partner companies to test their webhook integrations.

## Features

- Generate realistic Traxo `email.updated` webhook payloads with randomized travel segments (air, hotel, car, rail, rideshare)
- Send payloads to any webhook URL with optional HMAC-SHA256 signing (`x-traxo-signature` header)
- Save and manage multiple webhook targets
- Edit payloads before sending
- View send history with status codes and responses
- Copy payloads as JSON or curl commands

## Download

Download the latest version for your platform from [GitHub Releases](https://github.com/mattgriffin/traxo-webhook-tester/releases).

| Platform | Format |
|----------|--------|
| macOS    | `.dmg` |
| Windows  | `.exe` |
| Linux    | `.AppImage`, `.deb` |

> **macOS note:** This app is not code-signed. macOS will block it on first launch. To allow it, open Terminal and run:
>
> ```bash
> xattr -cr /Applications/Traxo\ Webhook\ Tester.app
> ```
>
> Then open the app normally.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 20+

### Setup

```bash
npm install
```

### Run in browser (with Vite dev proxy)

```bash
npm run dev
```

### Run as Electron app

```bash
npm run dev:electron
```

### Build installer for your platform

```bash
npm run build:electron
```

Installers are output to the `release/` directory.

## Releasing a New Version

1. Update the `version` in `package.json`
2. Commit and push your changes
3. Tag the release and push the tag:

```bash
git tag v1.0.0
git push --tags
```

GitHub Actions will automatically build installers for macOS, Windows, and Linux, and create a draft release. Review and publish the release on GitHub.
