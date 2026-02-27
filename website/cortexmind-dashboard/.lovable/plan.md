
# CortexFlow — Cognitive State Monitoring Dashboard (Phase 1: Core)

## Overview
A dark-themed, neuroscience-inspired dashboard for monitoring cognitive states during work sessions. This phase covers authentication, session management, and the main analytics dashboard. All data comes from API calls — no hardcoded data.

## Design & Theme
- **Dark theme** with deep backgrounds (#0a0a0f, #12121a), purple accent (#6c63ff), and color-coded metrics (red=instability, blue=drift, orange=fatigue, green=stable)
- **Inter font** for UI, monospace for metric numbers
- Professional, minimal, neuroscience-inspired aesthetic
- Fully responsive layout with sidebar navigation

## Architecture
- **TypeScript** throughout (.tsx/.ts)
- **API client** using native fetch with centralized config (base URL as a constant, JWT interceptor logic, 401 redirect handling)
- **React Query** for all data fetching with loading skeletons, error states, and empty states
- **AuthContext** and **SessionContext** for global state
- Business logic in custom hooks, not page components
- All API endpoints documented with expected request/response shapes

## Pages & Features

### 1. Authentication (Login & Register)
- Clean minimal login form (email + password) at `/login`
- Registration form (name, email, password) at `/register`
- JWT token stored in localStorage, attached to all requests
- Redirect to `/dashboard` on success
- ProtectedRoute wrapper for all authenticated pages

### 2. Dashboard (`/dashboard`)
- **Session selector dropdown** — pick from past sessions (default: most recent)
- **Brain visualization** — animated SVG with three concentric pulsing rings (ECN, DMN, Salience) driven by API data
- **Timeline Chart** (Recharts LineChart) — instability, drift, fatigue over time
- **Network Radar Chart** (Recharts RadarChart) — ECN, DMN, Salience, Load
- **4 Attention Summary Cards** — Deep Work %, Total Switches, Re-entry Cost (switches × 18 min), Avg Instability
- **Intervention Markers** — color-coded timeline of triggered interventions
- **Session Summary Table** — recent sessions, clickable rows to session detail
- Empty state with CTA to start a session when no data exists
- All charts show skeleton loaders while fetching

### 3. Start Session (`/session/start`)
- Form with task type dropdown (Writing, Reading, Coding, Watching, Research) and optional duration input
- Warning if a session is already active, with option to stop it first
- Success toast and redirect to dashboard on submit

### 4. Active Session Banner
- Fixed banner at top when a session is active
- Shows task type and live counting timer
- Stop Session button in the banner

### 5. Layout & Navigation
- Sidebar with navigation links: Dashboard, Start Session, Session History
- Navbar with user info and session status
- Sidebar collapses to icon mode on smaller screens

### 6. Error Handling & Toasts
- Every API call shows: skeleton (loading), error card with retry (error), helpful empty state (no data)
- Toast notifications for session start/stop, login, and API errors

## Deferred to Phase 2
- Session History page (`/session/history`)
- Session Detail page (`/session/:id`)
- These will reuse the same chart components built in Phase 1
