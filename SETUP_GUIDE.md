# Setup Guide - Social Auto Poster Pro

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Windows/Mac/Linux operating system

## Installation Steps

### 1. Install Dependencies

```bash
cd social-auto-poster-pro
npm install
```

### 2. Database Setup

Generate Prisma client:

```bash
npm run prisma:generate
```

This creates the SQLite database file and generates the Prisma client.

### 3. Run Development Server

```bash
npm run dev
```

The application will be available at: http://localhost:5173/

### 4. Build Desktop App

To build the Electron desktop application:

```bash
npm run build
```

This creates:
- Web build in `dist/` directory
- Electron build in `dist-electron/` directory

## Project Structure

```
social-auto-poster-pro/
├── electron/              # Electron main and preload scripts
│   ├── main.ts           # Electron main process
│   └── preload.ts        # Preload script for IPC
├── prisma/               # Database schema and migrations
│   └── schema.prisma     # Prisma schema definition
├── src/
│   ├── components/       # React components
│   │   ├── layout/       # Layout components (Sidebar, Topbar)
│   │   └── ui/           # Reusable UI components
│   ├── pages/            # Page components
│   │   ├── Dashboard.tsx
│   │   ├── CreatePostPage.tsx
│   │   ├── PostsPage.tsx
│   │   ├── CalendarPage.tsx
│   │   └── SettingsPage.tsx
│   ├── services/         # Business logic services
│   │   ├── PostService.ts
│   │   ├── MediaService.ts
│   │   ├── ScheduleService.ts
│   │   └── LoggerService.ts
│   ├── store/            # State management (Zustand)
│   ├── lib/              # Utility functions
│   ├── App.tsx           # Main App component
│   └── main.tsx          # React entry point
└── package.json          # Dependencies and scripts
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:studio` - Open Prisma Studio (database GUI)

## Features Implemented (Phase 1)

✅ **Core Infrastructure**
- Electron desktop app setup
- React + TypeScript frontend
- Prisma ORM with SQLite database
- Vite build system
- TailwindCSS styling

✅ **UI Components**
- Modern, responsive layout with sidebar navigation
- Dark/Light theme support
- Reusable UI components (Button, Card, Input, Textarea, Badge, etc.)

✅ **Pages**
- Dashboard with statistics overview
- Posts management page with filtering and search
- Calendar view for scheduled posts
- Create post form with media upload
- Settings page

✅ **Services Layer**
- PostService: Create, read, update, delete posts
- MediaService: Handle media file uploads and storage
- ScheduleService: Manage post scheduling
- LoggerService: Application logging

✅ **Database Schema**
- Posts table with status tracking
- Media attachments support
- Platform targeting (Facebook, TikTok)
- Scheduling information

## Next Steps (Phase 2)

🔄 **Platform Integration**
- Facebook Graph API integration
- TikTok API integration
- OAuth authentication flows
- Post publishing automation

🔄 **Advanced Features**
- Analytics dashboard
- Post templates
- Bulk scheduling
- Error handling and retry logic
- Notification system

## Database Schema

The application uses SQLite with the following main models:

### Post
- id: Unique identifier
- title: Optional post title
- content: Post text content
- status: draft, scheduled, publishing, published, failed
- platforms: Array of target platforms
- scheduledAt: When to publish
- publishedAt: When actually published
- mediaPath: Path to attached media

### Media
- id: Unique identifier
- postId: Related post
- type: image or video
- filename: Original filename
- path: Storage path
- mimeType: File MIME type
- size: File size in bytes

## Troubleshooting

### Prisma Client Not Found
Run: `npm run prisma:generate`

### Port Already in Use
Change the port in `vite.config.ts` or kill the process using port 5173

### Build Errors
1. Delete `node_modules` and `package-lock.json`
2. Run `npm install`
3. Run `npm run prisma:generate`
4. Run `npm run dev`

## Technology Stack

- **Frontend**: React 18, TypeScript, TailwindCSS
- **Desktop**: Electron
- **Database**: Prisma ORM + SQLite
- **State**: Zustand
- **UI Components**: Radix UI primitives
- **Build**: Vite
- **Icons**: Lucide React

## License

Proprietary - All rights reserved