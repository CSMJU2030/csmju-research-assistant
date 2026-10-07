import { NextResponse } from 'next/server';
export function GET(request: Request) { return NextResponse.redirect(new URL('/auth/login', request.url), 302); }
