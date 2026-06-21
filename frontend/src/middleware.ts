import { NextResponse } from 'next/server';

// Auth middleware disabled for now - will be re-enabled later
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
