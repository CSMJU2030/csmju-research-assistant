import { NextResponse } from 'next/server';
export function POST(request: Request) { return NextResponse.redirect(new URL('/auth/logout', request.url), 307); }
