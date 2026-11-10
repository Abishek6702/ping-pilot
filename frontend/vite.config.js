import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const googleClientId =
    env.VITE_GOOGLE_CLIENT_ID ||
    env.GOOGLE_CLIENT_ID ||
    '1022446873245-2lu7vuej60apgk0rql9gi0ue6ch6c64j.apps.googleusercontent.com'

  const apiUrl =
    env.VITE_API_URL ||
    env.VITE_API_BASE_URL ||
    'http://localhost:4001/api'

  return {
    plugins: [tailwindcss(), react()],
    server: {
      port: 4000,
      host: true,
    },
    define: {
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(googleClientId),
      'import.meta.env.GOOGLE_CLIENT_ID': JSON.stringify(googleClientId),
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
    },
  }
})
