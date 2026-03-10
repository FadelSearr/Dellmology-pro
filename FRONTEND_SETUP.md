# Frontend Setup & Local Development Guide

## Quick Start (5 minutes)

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- VS Code (recommended)

### 1. Install Dependencies

    render(<Section0_CommandBar />);
    expect(screen.getByText(/GLOBAL CORRELATION/i)).toBeInTheDocument();
  });
});
```

---

## API Integration

### Streaming (SSE)
```tsx
useEffect(() => {
  const eventSource = new EventSource('/api/stream');
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    // Handle data
  };
  return () => eventSource.close();
}, []);
```

### REST Endpoints
```tsx
const response = await fetch('/api/broker-flow?symbol=BBCA');
const data = await response.json();
```

---

## Troubleshooting

### SSE Connection Failed
```
Error: Failed to connect to streamer
✓ Check if Go engine is running on localhost:8080
✓ Check NEXT_PUBLIC_STREAMER_URL in .env.local
✓ Check browser console for CORS errors
```

### TypeScript Errors
```bash
# Clear cache and rebuild
rm -rf .next
npm run build
```

### Port Already in Use
```bash
# Kill process on port 3000
lsof -i :3000
kill -9 <PID>
```

---

## Deployment (see DEPLOYMENT.md)

Ready for Vercel, Netlify, or self-hosted deployment.

---

**Questions? Issues?** Check FRONTEND_STRUCTURE.md for detailed architecture.
