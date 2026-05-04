import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(_request: NextRequest) {
  // proxy.tsではクッキーチェックのみ行い
  // クライアントサイドの認証チェックはlayoutに任せる
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
