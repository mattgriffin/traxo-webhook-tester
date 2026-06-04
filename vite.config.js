import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

function webhookProxy() {
  return {
    name: 'webhook-proxy',
    configureServer(server) {
      server.middlewares.use('/api/proxy', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405);
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        const targetUrl = req.headers['x-target-url'];
        if (!targetUrl) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Missing x-target-url header' }));
          return;
        }

        // Read request body
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks);

        // Build forwarded headers (exclude hop-by-hop and proxy headers)
        const forwardHeaders = {};
        for (const [key, value] of Object.entries(req.headers)) {
          if (!['host', 'connection', 'x-target-url', 'origin', 'referer'].includes(key)) {
            forwardHeaders[key] = value;
          }
        }

        try {
          const upstream = await fetch(targetUrl, {
            method: 'POST',
            headers: forwardHeaders,
            body,
          });
          const responseBody = await upstream.text();
          res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'text/plain' });
          res.end(responseBody);
        } catch (e) {
          res.writeHead(502);
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    tailwindcss(),
    webhookProxy(),
  ],
});
