# Bitpop

[![CI](https://github.com/frederikb96/bitpop/actions/workflows/ci.yaml/badge.svg)](https://github.com/frederikb96/bitpop/actions/workflows/ci.yaml)
[![Release](https://img.shields.io/github/v/release/frederikb96/bitpop)](https://github.com/frederikb96/bitpop/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Terminal UI for Bitwarden with fuzzy search and keyboard-driven workflow.

## Features

- **Fuzzy search** across all vault items (logins, cards, identities, SSH keys, notes)
- **Quick copy** - Ctrl+U/P/T for username/password/TOTP
- **Local TOTP** - generates codes locally, no CLI round-trip
- **Shortcuts** - define search presets for quick access
- **Auto-lock** - configurable session timeout
- **Sync** - Ctrl+R to refresh from Bitwarden servers

## Requirements

- [Bitwarden CLI](https://bitwarden.com/help/cli/) (`bw`) installed and logged in
- [Bun](https://bun.sh/) runtime
- Linux with Wayland (`wl-copy`) or X11 (`xclip`) for clipboard

## Installation

```bash
git clone https://github.com/frederikb96/bitpop.git
cd bitpop
bun install
bun link  # makes 'bitpop' command globally available
```

## Usage

```bash
bitpop
```

Enter your master password to unlock the vault. Then:

| Key | Action |
|-----|--------|
| Type | Fuzzy search |
| ↑/↓ | Navigate results |
| Enter | View item details |
| Ctrl+U | Copy username |
| Ctrl+P | Copy password |
| Ctrl+T | Copy TOTP code |
| Ctrl+R | Sync from server |
| Ctrl+X | Clear search |
| Ctrl+Space | Shortcut mode |
| Esc | Back / Quit |

## Configuration

Config file: `~/.config/bitpop/config.yaml`

```yaml
auto_close_hours: 4        # Session timeout (default: 4)
max_visible_entries: 30    # Results shown (default: 10)
clipboard_clear_seconds: 0 # Clear clipboard after copy (0 = disabled)

shortcuts:
  - key: "g"
    search: "github"
    description: "GitHub accounts"
```

Press Space to enter shortcut mode, then press the shortcut key.

## Security Model

Bitpop wraps Bitwarden CLI - it inherits BW's security model:

- Master password unlocks vault via `bw unlock`
- Session token stored in memory (not disk)
- Vault locked on exit via `bw lock`
- Auto-close timeout prevents indefinite sessions

**What bitpop does NOT do:**
- Store or cache your master password
- Write secrets to disk
- Keep sessions alive after exit

## Development

```bash
bun run dev      # Run in dev mode
bun run lint     # Check code
bun test         # Run tests
```

## License

MIT
