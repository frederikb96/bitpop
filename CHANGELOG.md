# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-01-31

### Added

- TOTP expiry warning - shows yellow message when copied TOTP expires within threshold (configurable via `totp_expiry_warning_seconds`, default 5s)

## [0.1.1] - 2026-01-30

### Changed

- Auto-close timeout now resets on any keypress (inactivity-based instead of absolute)
- **Instant startup** - Password prompt now appears immediately instead of waiting 2-4s for BW CLI status checks

### Fixed

- Auto-close now uses wall-clock time, properly handles laptop suspend/resume

## [0.1.0] - 2026-01-24

### Added

- Edit config from shortcut mode (Ctrl+E) - opens config file in $EDITOR, hot-reloads on save
- Page Up/Down navigation - jumps by half the visible entries
- Backspace to go back from detail/shortcut mode (safer alternative to Esc)
- Create new login entries (Ctrl+N) - opens $EDITOR with YAML template
- Edit existing entries (Ctrl+E in detail view) - opens $EDITOR with item data
- Password generator (Ctrl+G) - toggle between random/passphrase, configurable defaults
- Password generation config in config.yaml (type, length, words, separator, capitalize, includeNumber)
- Custom fields support when creating/editing items
- Secure temp file handling (uses XDG_RUNTIME_DIR or ~/.cache/bitpop with 600 perms)
- Local password generation using EFF Diceware wordlist (7776 words, cryptographically secure)
- Passphrase customization: capitalize first letter, append random numbers to each word
- Processing indicator ("⏳ Processing...") during item create/edit operations
- Exit indicator ("⏳ Locking vault...") when closing the app
- "Password copied!" message in generator when using Ctrl+P
- After creating item with Ctrl+N, automatically navigates to detail view of new item
- Edit mode (Ctrl+E) now shows commented-out fields for unset values
- Custom fields now displayed in detail view (yellow for hidden fields)
- "No changes" detection skips API call when editor content unchanged
- Sort toggle (Ctrl+O in search) - switch between relevance/name and date order
- Loading indicator during vault unlock ("Unlocking vault...")
- Delete items (d key in detail view) - moves to trash with Y/n confirmation

### Fixed

- **CRITICAL: Edit data loss bug** - Editing items now preserves all metadata fields (id, organizationId, folderId, etc.) by merging parsed YAML with original item instead of sending only parsed fields
- **CRITICAL: YAML special character corruption** - Names/passwords containing quotes, newlines, or backslashes now properly escaped to prevent YAML parsing failures and data loss
- **CRITICAL: Non-Login item edit protection** - Editing Cards, Identities, SSH Keys, or Secure Notes now shows error message instead of silently corrupting data
- Commenting out fields in editor (e.g., custom_fields, notes) now properly removes them from item

### Changed

- Shortcut mode trigger changed from Space to Ctrl+S (works anytime)
- Password generation now local (instant) instead of BW CLI (was slow)
- Default password type changed from "random" to "passphrase"
- Default passphrase word count increased from 4 to 5
- Regenerate key in password generator changed from R to Ctrl+R (uniform with other shortcuts)
- Passphrase number suffix changed from 1-3 digits to 0-1 digit (50% chance)

## [0.0.0] - 2026-01-23

### Added

- Initial release
- Fuzzy search across vault items (logins, cards, identities, SSH keys, secure notes)
- Quick copy shortcuts: Ctrl+U (username), Ctrl+P (password), Ctrl+T (TOTP)
- Local TOTP generation (no CLI round-trip)
- Configurable search shortcuts (Space + key)
- Auto-close timeout (default 4 hours)
- Sync from Bitwarden servers (Ctrl+R)
- Wayland and X11 clipboard support
