# Volunteer Management System Architecture

## 1. Purpose

The Volunteer Management System is a web application for temple volunteer registration, visitor pass registration, admin operations, attendance tracking, KYC document handling, and volunteer ID / visitor pass printing.

The current implementation is intentionally simple in deployment shape:

- one React frontend
- one Express backend
- one PostgreSQL database
- Supabase Storage for uploaded files

## 2. High-Level Architecture

```text
Public Users / Admin Users
            |
            v
  React + Vite Single-Page App
            |
            v
      Express REST API
       /             \
      v               v
PostgreSQL       Supabase Storage
  data store      photos / Aadhaar files
```

Shared validation logic is reused by both frontend and backend through `shared/registrationValidation.js` so the same date and age rules are enforced in both places.

## 3. Repository Structure

```text
backend/
  src/index.js         Express server and API logic
  sql/schema.sql       Database schema and bootstrap SQL

frontend/
  src/App.jsx          Main React application shell
  src/visitorPassUi.js Visitor pass defaults and UI copy
  vite.config.js       Frontend dev server and proxy config

shared/
  registrationValidation.js   Shared date and age validation utilities

docs/
  PRD.md
  Architecture.md
```

## 4. Frontend Architecture

The frontend is a React single-page application built with Vite.

### Main characteristics

- The main UI and most application state live in `frontend/src/App.jsx`.
- The app uses client-side conditional rendering instead of a dedicated router.
- API calls are made to `/api` through `buildApiUrl()`.
- In local development, Vite proxies `/api` requests to `http://127.0.0.1:5000`.
- Admin session token and selected language are stored in `localStorage`.

### Functional areas in the frontend

#### Public user flows

- moon date selection and event discovery
- volunteer registration
- Aadhaar document reuse / upload workflow
- visitor pass registration
- registration confirmation and receipt display

#### Admin flows

- admin login
- event summary dashboard
- attendance management
- attendance-by-date lookup
- KYC preview and download
- slot count configuration
- volunteer ID card preview and printing
- visitor pass review and printing

### UI support modules

The frontend is mostly centralized in `App.jsx`, with a small supporting module:

- `frontend/src/visitorPassUi.js` contains initial visitor pass form state and localized UI text.

### Testing

- Frontend tests use Vitest.
- Testing Library and `@testing-library/jest-dom` are configured through `frontend/src/test/setupTests.js`.

## 5. Backend Architecture

The backend is a single Express application in `backend/src/index.js`.

### Main responsibilities

- environment and service configuration
- database schema bootstrap on startup
- admin authentication and session handling
- event and slot settings APIs
- volunteer registration APIs
- visitor pass APIs
- volunteer CRUD APIs
- attendance and admin reporting APIs
- file upload handling
- KYC document metadata and signed URL generation

### Technical components

- `express` for HTTP APIs
- `cors` for cross-origin access
- `morgan` for request logging
- `multer` with in-memory storage for multipart uploads
- `pg` for PostgreSQL access
- `@supabase/supabase-js` for object storage operations
- `bcrypt` for admin password verification

### API structure

The API is organized by route prefix, even though the implementation is in one file:

- public routes under `/api/...`
- admin routes under `/api/admin/...`

Important route groups include:

- health and settings
- visitor pass registration
- admin login and logout
- attendance and event summary
- volunteer registration and volunteer lookup
- document preview / download

### Authentication model

Admin authentication is session-token based:

- admin credentials come from environment variables
- login verifies the password hash with `bcrypt`
- the backend stores active admin sessions in an in-memory `Map`
- admin routes use bearer-token authentication via `requireAdminAuth`

This is simple and works for a single server process, but it is not a distributed session architecture.

## 6. Domain and Validation Layer

The shared module `shared/registrationValidation.js` provides common business validation used by both frontend and backend.

### Shared rules currently implemented

- ISO date parsing and normalization
- date-of-birth validation
- visit-date validation
- age calculation

This is one of the stronger architectural decisions in the project because it reduces validation drift between browser and server.

## 7. Data Architecture

The relational schema is defined in `backend/sql/schema.sql` and is applied at backend startup.

### Database characteristics

- PostgreSQL is the system of record.
- Schema bootstrap runs automatically when the backend starts.
- SQL also defines sequences and helper functions for generated IDs.

### Core tables

#### `volunteers`

Stores volunteer master data such as:

- name
- email
- phone
- address fields
- status
- photo metadata

#### `event_registrations`

Stores actual volunteering registrations, including:

- event identity
- registration type (`individual` or `team`)
- participant details
- date of birth
- attendance status
- generated volunteer ID
- registration dates history
- terms acceptance
- photo metadata

#### `volunteer_documents`

Stores metadata for Aadhaar uploads, including:

- volunteer ID and phone
- storage path
- file metadata
- masked Aadhaar last 4 digits
- verification status
- audit fields such as upload and verification timestamps

#### `visitor_pass_registrations`

Stores visitor pass requests, including:

- generated visitor pass ID
- visitor details
- visit date
- city and pincode
- registration timestamp

#### `event_settings`

Stores configurable slot counts used by the admin panel.

### ID generation

The database generates formatted identifiers through SQL helpers:

- volunteer IDs use the `SPST` prefix
- visitor pass IDs use the `VSPT` prefix

### Storage split

The system uses two persistence layers:

- PostgreSQL for structured application data
- Supabase Storage for uploaded photos and Aadhaar files

The database keeps the storage paths and metadata, while the backend creates signed URLs when the frontend needs secure access to files.

## 8. Event Model

Temple and event definitions are currently code-defined inside `backend/src/index.js`.

### Current design

- temples are stored in an in-memory array
- events are stored in an in-memory array
- event dates are derived from moon-phase calculations for the active year
- slot settings are stored in the database

This means event metadata is partly static in code and partly dynamic in the database.

## 9. Core Runtime Flows

### Volunteer registration flow

1. The user selects a moon date and event in the frontend.
2. The frontend validates basic input and builds a multipart request.
3. The request is sent to `POST /api/events/:id/register`.
4. The backend validates date, age, team rules, prior absence rules, and file inputs.
5. Uploaded photos and Aadhaar files are saved to Supabase Storage.
6. Registration data and document metadata are written to PostgreSQL.
7. The frontend shows confirmation and makes the volunteer record available for admin workflows.

### Visitor pass flow

1. The user fills the visitor pass form in the frontend.
2. The frontend validates visit date and required fields.
3. The request is sent to `POST /api/visitor-passes/register`.
4. The backend stores the pass in PostgreSQL and generates a pass number.
5. The frontend shows a printable confirmation-style receipt.

### Admin operations flow

1. An admin logs in through the frontend.
2. The backend validates credentials and returns a bearer token.
3. The frontend stores the token in `localStorage`.
4. Protected admin requests send the token in the `Authorization` header.
5. The backend checks the in-memory session map before serving admin data.

### Printing flow

Volunteer IDs and visitor passes are rendered on the frontend from API data and opened in print-ready browser markup. Printing is therefore currently a client-side presentation concern rather than a backend PDF-generation service.

## 10. Configuration and Runtime

### Frontend runtime

- Vite dev server runs on port `5173`
- `/api` is proxied to backend port `5000` in development
- optional `VITE_API_BASE_URL` can override the API base URL

### Backend runtime

- Express listens on port `5000` by default
- configuration is loaded from `backend/.env`

### Key backend configuration values

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `SUPABASE_DOCUMENTS_BUCKET`
- `SUPABASE_SIGNED_URL_EXPIRES_IN`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_TTL_SECONDS`

### Local development startup

At the repository root:

```bash
npm run dev
```

This starts:

- the backend with file watching
- the frontend Vite development server

## 11. Current Architectural Characteristics

### Strengths

- very simple deployment topology
- shared validation logic between frontend and backend
- clear separation between structured data and file storage
- admin and public workflows are already grouped at the API level
- printing is fast because it is generated directly in the browser

### Current constraints

- frontend logic is concentrated in a large `App.jsx`
- backend logic is concentrated in a large `index.js`
- event catalog is hardcoded instead of database-driven
- admin sessions are stored in memory, so they do not survive server restarts
- backend bootstrapping, routing, business rules, and persistence logic are tightly coupled

## 12. Suggested Future Decomposition

If the project grows, the natural next step is to split the backend and frontend by responsibility.

### Backend refactor seams

- `routes/`
- `controllers/`
- `services/`
- `repositories/`
- `storage/`
- `auth/`
- `validators/`

### Frontend refactor seams

- `pages/`
- `components/`
- `hooks/`
- `api/`
- `print/`
- `i18n/`

This would preserve the current product behavior while making the codebase easier to test, extend, and secure.
