import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getRole, BLOCKED_FOR_JULIA, BLOCKED_FOR_MARIANA } from '@/lib/roles'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isLoginRoute  = pathname === '/login'
  const isApiRoute    = pathname.startsWith('/api')
  const isPublicRoute = pathname.startsWith('/publico/')
  const isRoot        = pathname === '/'
  // Rotas de API que precisam continuar acessíveis sem sessão: usadas pela
  // página pública de aprovação do cliente (token próprio), ou já protegidas
  // por segredo próprio (crons via CRON_SECRET).
  const isPublicApiRoute =
    pathname.startsWith('/api/public/') ||
    pathname.startsWith('/api/cron/') ||
    pathname === '/api/upload'

  if (!user) {
    // API interna sem sessão: nunca redireciona pra tela de login (isso
    // devolveria HTML pra quem esperava JSON) — responde 401 direto. É essa
    // checagem que faltava: antes, isApiRoute pulava a autenticação inteira
    // e qualquer pessoa conseguia ler/editar dados batendo direto em /api/*.
    if (isApiRoute && !isPublicApiRoute) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (!isLoginRoute && !isApiRoute && !isPublicRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  if (user && isLoginRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  if (user && isRoot) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Controle de acesso: Julia não acessa rotas bloqueadas
  if (user) {
    const role = getRole(user.user_metadata)

    if (role === 'julia') {
      const isBlocked = BLOCKED_FOR_JULIA.some(
        (route: string) => pathname === route || pathname.startsWith(route + '/')
      )
      if (isBlocked) {
        const url = request.nextUrl.clone()
        url.pathname = '/conteudo'
        return NextResponse.redirect(url)
      }
    }

    if (role === 'mariana') {
      const isBlocked = BLOCKED_FOR_MARIANA.some(
        (route: string) => pathname === route || pathname.startsWith(route + '/')
      )
      if (isBlocked) {
        const url = request.nextUrl.clone()
        url.pathname = '/tarefas'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
