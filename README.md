# Weekly Report Site

A Next.js application for Community Assistants to manage and track intentional interactions with residents.

## Features

- User authentication with role-based access
- Resident management with CSV import
- Interaction tracking and logging
- Weekly report autofill
- Admin dashboard for user and system management
- Dark/light theme support

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Session-based auth with bcrypt

## Development Setup

1. Clone the repository and install dependencies:
```bash
git clone https://github.com/ChefToan/Weekly-Report-Manager.git
cd Weekly-Report-Manager/frontend
npm install
```

2. Setup environment variables:
```bash
cp .env.example .env.local
```

Configure your `.env.local` with Supabase credentials.

3. Setup database by running SQL scripts in `/database/` folder in Supabase SQL editor.

4. Start development server:
```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## Build

```bash
npm run build
npm start
```

---

**Live Site**: https://weeklyreport.info
