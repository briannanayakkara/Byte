import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev-only: makes POST /api/chat work under `npm run dev`, running the exact
// same handler (api/chat.ts) that Vercel's Node runtime calls in production.
// Vercel pre-parses JSON bodies into req.body before invoking the handler,
// so this mimics that instead of having the handler read the raw stream
// itself -- otherwise the handler would behave differently per environment.
function apiChatDevMiddleware(): Plugin {
  return {
    name: 'api-chat-dev-middleware',
    configureServer(server) {
      server.middlewares.use('/api/chat', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
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
            const { default: handler } = await server.ssrLoadModule('/api/chat.ts')
            // `any`: structurally matches ApiResponse in api/chat.ts without importing
            // app source into config-time types; dev-only plumbing, not app logic.
            const apiRes: any = {
              status(code: number) {
                res.statusCode = code
                return apiRes
              },
              json(data: unknown) {
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify(data))
              },
            }
            await handler({ method: req.method, body }, apiRes)
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
  // Loads .env into process.env for server-side code (api/chat.ts) during
  // dev. Separate from import.meta.env's VITE_-prefix filtering for the
  // browser bundle -- this does not expose anything to the client.
  process.env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }

  return {
    plugins: [react(), tailwindcss(), apiChatDevMiddleware()],
  }
})
