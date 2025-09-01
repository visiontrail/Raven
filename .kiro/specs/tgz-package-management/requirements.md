# Requirements Document

## Introduction

The TGZ Package Management feature aims to enhance the existing packaging tool by providing a dedicated management interface for the TGZ packages that are generated. Currently, the packaging tool creates TGZ packages but lacks a centralized way to manage, view, and organize these packages. This feature will integrate with the existing "Files" functionality to provide a seamless experience for users to manage their packaged TGZ files.

## Requirements

### Requirement 1

**User Story:** As a user, I want to view all TGZ packages created by the packaging tool in the Files section, so that I can easily find and manage them.

#### Acceptance Criteria

1. WHEN the user navigates to the Files section THEN the system SHALL display a new category for "Packages" or "TGZ Packages"
2. WHEN the user selects the "Packages" category THEN the system SHALL display a list of all TGZ packages created by the packaging tool
3. WHEN a new package is created using the packaging tool THEN the system SHALL automatically add it to the Files section under the "Packages" category
4. WHEN a package is added to the Files section THEN the system SHALL extract and store relevant metadata from the package name (e.g., package type, version)
5. WHEN a package is displayed THEN the system SHALL show relevant metadata including package name, creation date, size, and package type (lingxi-10, lingxi-07a, config) and package version

### Requirement 2

**User Story:** As a user, I want to see and edit detailed information about each package, so that I can understand what it contains without opening it.

#### Acceptance Criteria

1. WHEN the user selects a package THEN the system SHALL display detailed information including package version, whether it's a patch, and which components are included(This is the base information about the package comes from the package itself)
2. WHEN detailed information is displayed THEN the system SHALL parse this information from the package name and structure if possible
3. WHEN the user selects a package THEN the system SHALL allow the user to modify the detailed information and add extra information to it. The detailed information SHALL be stored in a file or a database.

### Requirement 3

**User Story:** As a user, I want to be able to open, delete and upload TGZ packages from the Files section, so that I can manage them efficiently.

#### Acceptance Criteria

1. WHEN the user clicks on a package THEN the system SHALL open the package location in the file explorer
2. WHEN the user selects the delete option for a package THEN the system SHALL prompt for confirmation before deleting the package
3. WHEN the user confirms deletion THEN the system SHALL remove the package from both the file system and the database
4. When the user selects the "upload to device" option for a package, the system shall upload this file via the FTP protocol to a specific path on an FTP server. (This FTP server is derived from an MCP (Model Context Protocol) server; the MCP server is covered in another specification, so focus only on the FTP.)
5. When the user selects the "upload to server" option for a package, the system shall upload this file via the HTTP protocol to a specific path on an HTTP server with the package information comes from the Requirement 2. (This HTTP server is derived from web page server; the web page server is covered in another specification, so focus only on the HTTP.)

### Requirement 4

**User Story:** As a user, I want to be able to sort and filter packages by different criteria, so that I can find specific packages easily.

#### Acceptance Criteria

1. WHEN the user is in the Packages view THEN the system SHALL provide sorting options by date, name, size, and package type
2. WHEN the user applies a filter THEN the system SHALL display only packages matching the filter criteria
3. WHEN the user searches for packages THEN the system SHALL search through package names and metadata
