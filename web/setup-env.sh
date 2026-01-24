#!/bin/bash

# Setup script for web UI environment variables

echo "Setting up web UI environment variables..."

cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=https://qkcjlbycgytlinsblrja.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrY2psYnljZ3l0bGluc2JscmphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5OTgzOTEsImV4cCI6MjA4NDU3NDM5MX0.C4PRMr9e6-57acey6fx-DyuBVdNeEzq2RziNGKlpWbw
EOF

echo "✅ Created .env.local file"
echo ""
echo "Next steps:"
echo "  1. npm run dev"
echo "  2. Open http://localhost:3000"

