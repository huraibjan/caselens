---
name: frontend-development
description: Next.js App Router frontend development with TypeScript, React 19, shadcn/ui, and Tailwind CSS for the CaseLens legal platform.
---

# Frontend Development Skill

## Tech Stack
- Next.js 15 (App Router)
- TypeScript (strict mode)
- React 19
- shadcn/ui component library
- Tailwind CSS
- PDF.js for document viewing

## Design System
- Dark navy / graphite / warm neutral palette
- Light + dark theme support
- Inter font family
- Skeleton loading states on all data-fetching views
- Source-type visual badges (Evidence, AI Extraction, AI Inference, Verified, Rejected)

## Conventions
- Server Components by default; Client Components only when needed
- Colocate page-specific components in route directories
- Use React Server Actions for form mutations
- Implement optimistic updates for interactive elements
- All API calls through a typed client with error handling
- Responsive design: mobile-first breakpoints
