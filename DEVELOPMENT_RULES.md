# Development Rules & Guidelines

## Code Style

### TypeScript
- Use strict mode
- No `any` types - use proper typing
- Use interfaces for object shapes
- Use type aliases for unions and complex types
- Prefer functional components with hooks
- Use proper return types for functions

### React
- Functional components only
- Use hooks (useState, useEffect, etc.)
- Custom hooks for reusable logic
- Keep components under 200 lines
- One component per file
- Props interface at top of file

### Naming Conventions
- Components: PascalCase (e.g., `UserProfile.tsx`)
- Files: PascalCase for components, camelCase for utilities
- Functions: camelCase (e.g., `getUserData`)
- Constants: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)
- Interfaces: PascalCase with 'I' prefix optional (e.g., `User` or `IUser`)
- Types: PascalCase (e.g., `ThemeMode`)

### File Organization
```
component/
├── ComponentName.tsx       # Main component
├── ComponentName.test.tsx  # Tests (future)
└── index.ts               # Re-export (if needed)
```

## Component Guidelines

### Component Structure
```tsx
// 1. Imports
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// 2. Types/Interfaces
interface Props {
  title: string;
  onSave: () => void;
}

// 3. Component
export function ComponentName({ title, onSave }: Props) {
  // 4. Hooks
  const [state, setState] = useState('');
  
  // 5. Handlers
  const handleClick = () => {
    // logic
  };
  
  // 6. Effects
  useEffect(() => {
    // side effects
  }, []);
  
  // 7. Render
  return (
    <div className="container">
      {/* JSX */}
    </div>
  );
}
```

### Props
- Always define props interface
- Use destructuring
- Provide default values when appropriate
- Document complex props with JSDoc comments

### Hooks Rules
- Only call at top level
- Don't call in loops, conditions, or nested functions
- Use descriptive names: `useUserData`, not `useData`
- Custom hooks start with 'use'

## Styling

### Tailwind CSS
- Use Tailwind utility classes
- Avoid custom CSS unless absolutely necessary
- Use `cn()` helper for conditional classes
- Group utilities logically (layout, spacing, colors, etc.)
- Prefer Tailwind over inline styles

### Theme
- Use CSS variables for colors
- Support both light and dark themes
- Test all components in both themes
- Use semantic color names from design system

## State Management

### Local State
- Use `useState` for component-specific state
- Use `useReducer` for complex state logic
- Keep state as close as possible to where it's used

### Global State
- Use Zustand stores
- One store per feature domain
- Use selectors for derived state
- Persist only necessary data

### Form State
- Consider React Hook Form for complex forms
- Validate with Zod schemas
- Provide clear error messages

## Database

### Prisma
- Always use Prisma Client for database access
- Never write raw SQL unless absolutely necessary
- Use transactions for multi-step operations
- Handle errors appropriately

### Migrations
- Create migrations for schema changes
- Test migrations before applying to production
- Keep migrations atomic and reversible

## Security

### Token Storage
- Always encrypt tokens before storing
- Never log tokens or sensitive data
- Clear tokens on logout
- Implement token refresh logic

### Input Validation
- Validate all user input
- Use Zod for schema validation
- Sanitize data before database insertion
- Escape output to prevent XSS

### IPC Security
- Use context isolation
- Whitelist IPC channels
- Validate all IPC messages
- Never pass sensitive data through IPC unnecessarily

## Performance

### React Performance
- Use React.memo for expensive components
- Implement proper dependency arrays in useEffect
- Avoid inline function definitions in JSX
- Use useCallback and useMemo appropriately (but don't overuse)

### Build Performance
- Lazy load routes
- Code split large features
- Optimize images and assets
- Monitor bundle size

## Error Handling

### Try-Catch
- Wrap async operations in try-catch
- Log errors with context
- Show user-friendly error messages
- Implement error boundaries

### Logging
- Use winston for logging
- Log levels: error, warn, info, debug
- Include context in logs
- Don't log sensitive information

## Testing (Future)

### Unit Tests
- Test pure functions thoroughly
- Test custom hooks
- Test component logic
- Aim for 80% coverage

### Integration Tests
- Test user flows
- Test API integrations
- Test database operations
- Mock external dependencies

## Git Workflow

### Commits
- Write clear, descriptive commit messages
- Use conventional commits format
- Keep commits atomic and focused
- Reference issue numbers

### Branches
- `main` - production ready code
- `develop` - integration branch
- `feature/*` - new features
- `fix/*` - bug fixes
- `refactor/*` - code refactoring

### Pull Requests
- Fill out PR template
- Request reviews from team
- Address review comments
- Squash commits before merge

## Documentation

### Code Comments
- Write self-documenting code
- Comment complex logic
- Use JSDoc for public APIs
- Keep comments up to date

### README
- Keep README current
- Include setup instructions
- Document environment variables
- Provide usage examples

## Don'ts

❌ Don't use `any` type
❌ Don't ignore TypeScript errors
❌ Don't commit commented-out code
❌ Don't commit console.logs
❌ Don't hardcode values
❌ Don't ignore errors silently
❌ Don't write components over 300 lines
❌ Don't use inline styles
❌ Don't skip prop validation
❌ Don't use non-semantic HTML

## Do's

✅ Use TypeScript strict mode
✅ Write self-documenting code
✅ Handle errors gracefully
✅ Test your changes
✅ Follow accessibility guidelines
✅ Keep components small and focused
✅ Use semantic HTML
✅ Implement proper loading states
✅ Provide user feedback
✅ Keep dependencies up to date