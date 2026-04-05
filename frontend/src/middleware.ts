import { NextRequest, NextResponse } from 'next/server';

// Auth middleware disabled for now - will be re-enabled later
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
