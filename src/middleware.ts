import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "mdc_user";
const ROTAS_PUBLICAS = ["/login"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const temSessao = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  const ehPublica = ROTAS_PUBLICAS.some((r) => pathname.startsWith(r));

  if (!temSessao && !ehPublica) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?from=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  if (temSessao && ehPublica) {
    // "/" decide a home por papel (admin → Visão Geral; demais → Dashboard).
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
