# Social Auto Poster Pro

A production-grade desktop application for automated social media posting to Facebook and TikTok.

## 🚀 Features (Phase 1 - Foundation)

### ✅ Completed
- **Modern Desktop App**: Built with Electron, React 18, and TypeScript
- **Beautiful UI**: shadcn/ui components with Tailwind CSS
- **Dark/Light Theme**: Fully customizable theme system with system preference detection
- **Responsive Layout**: Sidebar navigation, topbar with notifications
- **Database Ready**: SQLite with Prisma ORM
- **State Management**: Zustand for global state
- **Logging System**: Winston for comprehensive logging
- **Type Safety**: Strict TypeScript configuration

### 🔜 Coming Soon (Phase 2)
- Facebook OAuth integration
- TikTok OAuth integration
- Post creation and scheduling
- Auto-posting engine
- Calendar view
- Media library

## 📋 Prerequisites

- **Node.js**: v18 or higher
- **npm**: v9 or higher
- **Operating System**: Windows 10/11 (Mac/Linux support coming)

## 🛠️ Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd social-auto-poster-pro
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup database
```bash
npx prisma generate
npx prisma migrate dev --name init
```

## 🚀 Development

### Run in development mode
```bash
npm run electron:dev
```

This will:
- Start Vite dev server with HMR
- Launch Electron application
- Open DevTools automatically

### Run web-only development
```bash
npm run dev
```

Access at http://localhost:5173

## 📦 Build

### Build for production
```bash
npm run electron:build
```

This creates a distributable package in the `release/` directory.

## 📁 Project Structure

```
social-auto-poster-pro/
├── electron/              # Electron main process
│   ├── main.ts           # App entry point
│   └── preload.ts        # Bridge script
├── prisma/               # Database
│   └── schema.prisma     # Database schema
├── src/                  # React application
│   ├── components/       # React components
│   │   ├── layout/      # Layout components
│   │   └── ui/          # UI components (shadcn)
│   ├── lib/             # Utilities
│   ├── pages/           # Application pages
│   ├── store/           # Zustand stores
│   ├── App.tsx          # Root component
│   ├── main.tsx         # React entry
│   └── index.css        # Global styles
├── ARCHITECTURE.md       # Architecture documentation
├── TASKS.md             # Development tasks
├── DEVELOPMENT_RULES.md # Coding guidelines
└── package.json         # Dependencies
```

## 🎨 Tech Stack

### Core
- **Electron** - Desktop application framework
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool

### UI & Styling
- **Tailwind CSS** - Utility-first CSS
- **shadcn/ui** - Component library
- **Lucide React** - Icons
- **Radix UI** - Accessible primitives

### Data & State
- **Prisma** - ORM
- **SQLite** - Database
- **Zustand** - State management

### Utilities
- **React Router** - Routing
- **winston** - Logging
- **node-cron** - Scheduling
- **zod** - Validation

## 📖 Documentation

- [Architecture](./ARCHITECTURE.md) - System architecture and design decisions
- [Tasks](./TASKS.md) - Development roadmap and tasks
- [Development Rules](./DEVELOPMENT_RULES.md) - Coding standards and guidelines

## 🎯 Current Status

**Phase 1 (Foundation)**: ✅ Complete

The application foundation is complete with:
- Full Electron + React + Vite setup
- Modern UI with theme support
- Database schema ready
- Logging and state management
- Clean architecture

**Next Steps**: Phase 2 implementation
- OAuth integrations
- Post creation UI
- Scheduling system
- Auto-posting engine

## 🔧 Configuration

### Environment Variables (Future)
Create a `.env` file in the root:
```env
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
TIKTOK_CLIENT_KEY=your_client_key
TIKTOK_CLIENT_SECRET=your_client_secret
```

## 🐛 Troubleshooting

### Port already in use
If you see "Port 5173 is in use", Vite will automatically try the next available port.

### Prisma issues
```bash
# Reset database
npx prisma migrate reset

# Regenerate client
npx prisma generate
```

### Build errors
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

## 📝 Scripts

- `npm run dev` - Start Vite dev server
- `npm run electron:dev` - Run Electron app in development
- `npm run build` - Build for production
- `npm run electron:build` - Package Electron app

## 🤝 Contributing

1. Follow the [Development Rules](./DEVELOPMENT_RULES.md)
2. Create feature branches: `feature/your-feature-name`
3. Write clean, typed code
4. Test thoroughly before committing

## 📄 License

MIT License - See LICENSE file for details

## 🎓 Learning Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com)

## 🔐 Security

- Tokens are encrypted before storage
- Context isolation enabled
- No eval() or unsafe operations
- HTTPS-only external requests

## 📊 Performance

- Fast HMR with Vite
- Optimized bundle size
- SQLite for local-first performance
- Code splitting with React Router

## 🎯 Roadmap

### Phase 1: Foundation ✅
- Project setup
- UI framework
- Database schema
- Theme system

### Phase 2: Core Features (Weeks 3-6)
- OAuth integrations
- Post creation
- Scheduling
- Auto-posting

### Phase 3: Enhanced Features (Weeks 7-10)
- Content library
- Analytics
- Advanced scheduling

### Phase 4: Polish (Weeks 11-12)
- Testing
- Documentation
- Distribution

---

**Built with ❤️ using modern web technologies**