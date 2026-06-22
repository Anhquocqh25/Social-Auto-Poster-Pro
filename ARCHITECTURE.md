# Architecture Documentation

## Project Overview
Social Auto Poster Pro is a desktop application built with Electron, React, and TypeScript that enables automated posting to social media platforms (Facebook and TikTok).

## Technology Stack

### Frontend
- **Electron**: Cross-platform desktop application framework
- **React 18**: UI library with hooks
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool and dev server
- **TailwindCSS**: Utility-first CSS framework
- **shadcn/ui**: High-quality React components built on Radix UI
- **Lucide React**: Icon library
- **React Router**: Client-side routing

### State Management
- **Zustand**: Lightweight state management
- **Zustand Persist**: Persistent storage middleware

### Database
- **Prisma**: Modern ORM
- **SQLite**: Embedded database for local storage

### Utilities
- **winston**: Logging framework
- **node-cron**: Task scheduling
- **zod**: Schema validation

## Project Structure

```
social-auto-poster-pro/
├── electron/                   # Electron main process
│   ├── main.ts                # Main process entry
│   └── preload.ts             # Preload script (bridge)
├── prisma/                    # Database
│   └── schema.prisma          # Database schema
├── src/                       # React application
│   ├── components/
│   │   ├── layout/           # Layout components
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Topbar.tsx
│   │   └── ui/               # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── tabs.tsx
│   │       └── switch.tsx
│   ├── lib/                  # Utility libraries
│   │   ├── logger.ts         # Winston logger
│   │   └── utils.ts          # Helper functions
│   ├── pages/                # Application pages
│   │   ├── Dashboard.tsx
│   │   ├── CalendarPage.tsx
│   │   ├── PostsPage.tsx
│   │   └── SettingsPage.tsx
│   ├── store/                # Zustand stores
│   │   └── useThemeStore.ts  # Theme management
│   ├── App.tsx               # Root component
│   ├── main.tsx              # React entry point
│   └── index.css             # Global styles
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## Architecture Principles

### 1. Clean Architecture
- Separation of concerns between UI, business logic, and data
- Components are focused and single-responsibility
- Feature-based organization for scalability

### 2. Type Safety
- Strict TypeScript configuration
- Prisma for type-safe database queries
- Zod for runtime validation

### 3. Modularity
- Reusable UI components
- Composable layout system
- Feature-based code organization

### 4. Performance
- Vite for fast HMR and builds
- SQLite for local-first performance
- Efficient React rendering patterns

## Data Flow

### Theme Management
```
User Action → useThemeStore → localStorage → DOM class update
```

### Database Operations (Future)
```
Component → Prisma Client → SQLite → Response
```

### Electron IPC (Future)
```
Renderer Process → IPC → Main Process → System API → Response
```

## Component Architecture

### Layout System
- **AppLayout**: Main container with sidebar and content area
- **Sidebar**: Navigation and platform status
- **Topbar**: Page title, notifications, theme toggle

### Page Components
- Each page is a standalone functional component
- Uses shadcn/ui components for consistency
- Follows responsive design patterns

### UI Components
- Built on Radix UI primitives
- Fully accessible (ARIA compliant)
- Themeable with CSS variables
- Consistent styling with Tailwind

## State Management Strategy

### Local State
- Use React hooks (useState, useReducer) for component-specific state

### Global State
- Zustand stores for cross-component state
- Persistent storage for user preferences

### Server State (Future)
- React Query or similar for API data caching
- Optimistic updates for better UX

## Security Considerations

### Token Storage
- Tokens encrypted before storage in SQLite
- Never exposed in logs or error messages

### IPC Communication
- Context isolation enabled
- Preload script whitelist approach
- No direct Node.js access from renderer

### Content Security
- CSP headers configured
- No eval() or unsafe-inline
- HTTPS-only external requests

## Build and Distribution

### Development
```bash
npm run electron:dev
```

### Production Build
```bash
npm run electron:build
```

### Distribution
- Electron Builder for packaging
- NSIS installer for Windows
- Code signing recommended for production

## Future Architecture Enhancements

### Phase 2
- Add React Query for API state management
- Implement background service worker
- Add proper error boundaries
- Implement analytics tracking

### Phase 3
- Microservices for heavy operations
- Cloud sync capabilities
- Real-time collaboration features
- Plugin system for extensibility

## Performance Optimization

### Current
- Code splitting via React Router
- Lazy loading of heavy components
- Optimized bundle size with Vite

### Planned
- Virtual scrolling for large lists
- Image optimization and lazy loading
- Database query optimization
- Memory leak prevention strategies

## Testing Strategy (Future)

### Unit Tests
- Vitest for component testing
- Testing Library for React components

### Integration Tests
- Playwright for E2E testing
- Database integration tests

### Manual Testing
- QA checklist for each release
- Cross-platform testing (Windows/Mac/Linux)