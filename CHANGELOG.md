<!-- @format -->

# Change Log

All notable changes to the "vscode-web-browser" extension will be documented in this file.

## [Unreleased]

### Fixed

-   Bookmarks not saving
-   Remove "https://" from tab title when address changes for existing tab
-   Session handling so google.com loads properly
-   Forward/Backward navigation button not working

### Added

#### Integration with VS Code

-   Use VS Code's Extension API to create a custom view container
-   Add a sidebar icon for easy access to the browser

#### BrowserView setup

-   Create a BrowserView within the VS Code window
-   Implement basic navigation controls (back, forward, refresh, home)

#### Address bar

-   Implement autocomplete for URLs

#### Developer tools

-   Integrate Chromium DevTools for web development
-   Add a toggle to show/hide DevTools

#### Settings and customization

-   Allow users to set a homepage
-   Provide options for default search engine

#### Security features

-   Implement basic security checks for URLs
-   Add options for content blocking

#### Performance optimization

-   Use lazy loading for tabs not in view
-   Implement proper memory management

#### Keyboard shortcuts

-   Add custom shortcuts for browser actions
-   Allow users to customize shortcuts

#### Context menu

-   Implement a right-click context menu with common browser actions

#### Extension support

-   Consider allowing Chrome extensions to be used in the browser

### Changed

-   Make history set unique in most-recently-used order

### Removed

### Deprecated

### Added

### Security

## [1.0.5] - 2024-08-13

### Changed

-   Updated readme and changelog

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
