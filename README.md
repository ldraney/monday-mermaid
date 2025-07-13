# Next.js 15 + Mermaid.js Template

A minimal, modern template for building interactive diagram applications with Next.js 15, TypeScript, and Mermaid.js.

## ✨ Features

- ✅ **Next.js 15** with App Router and React 18
- ✅ **TypeScript** with strict configuration  
- ✅ **Mermaid.js** loaded via CDN (zero bundle bloat)
- ✅ **Zero deprecated dependencies** (clean `npm install`)
- ✅ **PostgreSQL ready** with simple postgres client
- ✅ **Minimal but complete** - perfect starting point

## 🚀 Quick Start

```bash
# Use this template
git clone https://github.com/ldraney/nextjs-mermaid-template.git my-diagram-app
cd my-diagram-app

# Install dependencies (clean, no warnings!)
npm install

# Start development
npm run dev
# Visit http://localhost:3005
```

## 📁 Project Structure

```
nextjs-mermaid-template/
├── app/
│   ├── layout.tsx          # Root layout with Mermaid.js CDN
│   └── page.tsx            # Interactive dashboard example
├── lib/
│   └── types.ts            # TypeScript interfaces & utilities
├── package.json            # Minimal, clean dependencies
├── tsconfig.json           # TypeScript configuration
└── README.md               # This file
```

## 🎯 Perfect For

- **Organizational charts** and flowcharts
- **System architecture** diagrams  
- **Process visualization** applications
- **Data relationship** mapping
- **Interactive dashboards** with diagrams
- **API visualization** tools

## 🧩 What's Included

### Mermaid.js Integration
- CDN loading (no package.json bloat)
- Proper Next.js Script component setup
- Client/server component handling
- TypeScript interfaces for diagrams

### Clean Dependencies
```json
{
  "next": "^15.1.3",
  "react": "^18.3.1", 
  "postgres": "^3.4.7",
  "nanoid": "^5.0.9",
  "date-fns": "^4.1.0",
  "zod": "^3.24.1"
}
```

### TypeScript Foundation
- Strict TypeScript configuration
- Diagram type definitions
- API response interfaces  
- Utility type guards

## 🔧 Customization

### Add Your Diagram Types
```typescript
// lib/types.ts
export interface MyDiagramData {
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  config: DiagramConfig
}
```

### Create Mermaid Components
```typescript
'use client'
import { useEffect, useRef } from 'react'

export function MyDiagram({ definition }: { definition: string }) {
  const ref = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (window.mermaid && ref.current) {
      ref.current.innerHTML = definition
      window.mermaid.run({ nodes: [ref.current] })
    }
  }, [definition])

  return <div ref={ref} className="mermaid" />
}
```

### Database Integration
Ready for PostgreSQL with the included `postgres` client:

```typescript
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!)
const diagrams = await sql`SELECT * FROM diagram_data`
```

## 🌟 Example Use Cases

### Organizational Charts
Perfect for visualizing company structures, team hierarchies, and reporting relationships.

### System Architecture  
Great for microservices diagrams, data flow charts, and infrastructure mapping.

### Process Workflows
Ideal for business process mapping, user journeys, and decision trees.

### API Documentation
Excellent for endpoint relationships, data models, and integration flows.

## 📦 Extension Ideas

- Add **authentication** for private diagrams
- Integrate **real-time updates** with WebSockets  
- Build **collaborative editing** features
- Create **diagram templates** and themes
- Add **export functionality** (PNG, SVG, PDF)

## 🔨 Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production  
npm run start      # Start production server
npm run type-check # Verify TypeScript
```

## 🎨 Styling

Uses inline styles by default for simplicity. Easy to integrate with:
- **Tailwind CSS** 
- **styled-components**
- **CSS Modules**
- **Any CSS framework**

## 📝 Environment Variables

```bash
# Optional: Database connection
DATABASE_URL=postgresql://...

# Optional: API keys for external data
API_KEY=your_api_key
```

## 🤝 Contributing

This template is designed to be minimal and focused. For feature requests:

1. Fork the repository
2. Create your feature branch
3. Submit a pull request with clear description

## 📄 License

MIT License - feel free to use for any project!

## 🙏 Acknowledgments

- **Next.js** team for the excellent framework
- **Mermaid.js** for powerful diagram capabilities  
- **TypeScript** for type safety and developer experience

---

**Ready to build something amazing with diagrams?** This template gives you everything you need to get started quickly and cleanly! 🎯
