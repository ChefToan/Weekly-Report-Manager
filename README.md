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

# Weekly Report Site

A Next.js application for managing weekly reports and resident interactions for community assistants.

## 🚀 Features

- **User Authentication**: Secure login/registration with role-based access
- **Resident Management**: Import and manage resident data with room assignments
- **Interaction Tracking**: Log and track interactions with residents
- **Weekly Reports**: Generate and submit weekly progress reports
- **Admin Dashboard**: User management and registration code generation
- **Dark/Light Theme**: Modern UI with theme switching

## 🛠 Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Custom session-based auth with bcrypt
- **Deployment**: PM2, Nginx, Oracle Cloud Infrastructure

## 🔧 Development Setup

### Prerequisites
- Node.js 20+
- npm or yarn
- Supabase account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/ChefToan/Weekly-Report-Manager.git
cd Weekly-Report-Manager/frontend
```

2. Install dependencies:
```bash
npm install
```

3. Setup environment variables:
```bash
cp .env.example .env.local
```

4. Configure your `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

5. Setup database:
- Run the SQL scripts in `/database/` folder in your Supabase SQL editor
- Start with `db-create.sql` for the initial schema

6. Start development server:
```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   ├── login/             # Authentication pages
│   │   └── ...
│   ├── components/            # React components
│   │   ├── admin/            # Admin-specific components
│   │   ├── auth/             # Authentication components
│   │   ├── dashboard/        # Dashboard components
│   │   └── ui/               # Reusable UI components
│   ├── contexts/             # React contexts
│   ├── lib/                  # Utility libraries
│   └── utils/                # Helper functions
├── public/                   # Static assets
└── database/                 # SQL schema files
```

## 🏗 Build & Production

### Build for production:
```bash
npm run build
npm start
```

### Type checking:
```bash
npm run type-check
```

### Linting:
```bash
npm run lint
```

## 🚀 Deployment

See `DEPLOYMENT_GUIDE.md` for detailed deployment instructions for Oracle Cloud Infrastructure.

### Quick Deploy with PM2:
```bash
npm run build
pm2 start ecosystem.config.js
```

## 🔒 Security

This application includes several security features:
- Password hashing with bcrypt
- Session-based authentication
- CSRF protection
- Security headers via middleware
- Input validation and sanitization
- Role-based access control

**Important**: Review `SECURITY_AUDIT.md` before deploying to production.

## 📊 Features Overview

### For Community Assistants:
- Track daily interactions with residents
- Generate weekly reports
- View progress statistics
- Dark/light theme toggle

### For Administrators:
- User management
- Registration code generation
- Resident data import (CSV)
- System overview and statistics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🐛 Issues & Support

If you encounter any issues:
1. Check the `SECURITY_AUDIT.md` for known issues
2. Review the `DEPLOYMENT_GUIDE.md` for setup help
3. Create an issue in the GitHub repository

## 🎯 Roadmap

- [ ] Email notifications for weekly reports
- [ ] Advanced analytics and reporting
- [ ] Mobile app version
- [ ] API documentation
- [ ] Integration with external systems

---

**Live Site**: https://tookerbackyard.cheftoan.com