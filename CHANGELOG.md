# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-03-18

### Added

- Added runtime-neutral document import APIs via `PaintDocument.fromBytes()` and `PaintDocument.fromBitmap()`.
- Added `paintnt/node` for filesystem-backed `open()` and `save()` support in Node and Bun.
- Added `paintnt/browser` for `ImageData` and canvas interop in browser environments.
- Added distributable `dist/` output with JavaScript and declaration files for npm consumers.
- Added browser adapter coverage and Node adapter coverage in the test suite.
- Added a local Bun-powered browser sandbox for exercising the browser entrypoint.

### Changed

- Moved core document I/O behind a configurable adapter so the bitmap engine remains runtime-neutral.
- Updated package exports and metadata so Node and browser consumers can import supported entrypoints directly.
- Updated the README to document `paintnt`, `paintnt/node`, and `paintnt/browser`.

## [0.1.0] - 2026-03-17

### Added

- Initial release of `paintnt` as a Bun-first TypeScript bitmap graphics library.
- Added headless bitmap editing, drawing tools, selections, clipboard operations, transforms, text rendering, and BMP encode/decode support.
