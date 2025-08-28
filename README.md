# Weekly Report Site

A full-stack application for Community Assistants to manage and track intentional interactions with residents.

## Features

- Import resident data via CSV
- Log and manage intentional interactions
- Generate weekly reports in copy-paste format
- Track progress towards semester requirements
- Calculate interaction percentages

## Tech Stack

- **Frontend**: Next.js 14 with TypeScript, Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth

## Project Structure

```
├── frontend/           # Next.js frontend application
├── backend/           # API routes and server logic
├── shared/            # Shared types and utilities
└── docs/             # Documentation
```

## Getting Started

1. Install dependencies: `npm install`
2. Set up environment variables
3. Run development server: `npm run dev`