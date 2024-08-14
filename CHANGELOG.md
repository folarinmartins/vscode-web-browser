<!-- @format -->

# Change Log

All notable changes to the "vscode-web-browser" extension will be documented in this file.

## [Unreleased]

### Fixed

-   Bookmarks not saving
-   Remove "https://" from tab title when address changes for existing tab
-   Session handling so google.com loads properly
-   Forward/Backward navigation button not working

### Changed

-   Make history set unique in most-recently-used order

### Removed

### Deprecated

### Added

### Security

## [1.0.4] - 2024-08-13

### Added

-   Populated CHANGELOG.md with proper content

## [1.0.3] - 2024-08-13

### Fixed

-   Proper tab title derived from url instead of frame title
-   Padding for tab title panel

### Changed

-   Prepended all globalState saving keys to include mfolarin-vscode-browser-[history, bookmarks, tabs]

### Added

-   Product icon on vscode market place

## [1.0.2] - 2024-08-12

### Added

-   Initial release with basic functionalities including bookmarking, history, multiple tabs, fixed top and bottom panels
