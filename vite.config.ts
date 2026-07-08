import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev-only: makes /api/* work under `npm run dev`, running the exact same
// handler files Vercel's Node runtime calls in production (one file per
// route, auto-mapped by Vercel with no config needed). Vercel pre-parses
// JSON bodies into req.body before invoking a handler, so this mimics that
// instead of having handlers read the raw stream themselves -- otherwise a
// handler would behave differently per environment.
//
// `mountPath` is registered with Vite's connect-based dev middleware, which
// strips that prefix from req.url for the duration of the callback (e.g.
// mounting at '/api/admin' means a request to '/api/admin/login' arrives
// here with req.url === '/login') -- `resolveModulePath` turns whatever's
// left of the url into the '/api/...ts' file to ssrLoadModule.
function apiDevMiddleware(mountPath: string, resolveModulePath: (url: string) => string | null): Plugin {
  return {
    name: `api-dev-middleware${mountPath.replace(/\//g, '-')}`,
    configureServer(server) {
      server.middlewares.use(mountPath, (req, res) => {
        const modulePath = resolveModulePath(req.url ?? '')
        if (!modulePath) {
          res.statusCode = 404
          res.end()
          return
        }
        let raw = ''
        req.on('data', (chunk) => {
          raw += chunk
        })
        req.on('end', async () => {
          try {
            const body = raw ? JSON.parse(raw) : {}
            const { default: handler } = await server.ssrLoadModule(modulePath)
            // `any`: structurally matches ApiResponse in api/lib/adminAuth.ts
            // and api/chat.ts without importing app source into config-time
            // types; dev-only plumbing, not app logic.
            const apiRes: any = {
              status(code: number) {
                res.statusCode = code
                return apiRes
              },
              json(data: unknown) {
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify(data))
              },
              setHeader(name: string, value: string) {
                res.setHeader(name, value)
              },
            }
            await handler({ method: req.method, url: req.url, body, headers: req.headers }, apiRes)
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'dev middleware failed', detail: String(err) }))
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Loads .env into process.env for server-side code (api/**) during dev.
  // Separate from import.meta.env's VITE_-prefix filtering for the browser
  // bundle -- this does not expose anything to the client.
  process.env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }

  return {
    plugins: [
      react(),
      tailwindcss(),
      apiDevMiddleware('/api/chat', () => '/api/chat.ts'),
      apiDevMiddleware('/api/admin', (url) => {
        const path = url.split('?')[0]
        if (!/^\/[a-z]+$/.test(path)) return null
        return `/api/admin${path}.ts`
      }),
    ],
  }
})
