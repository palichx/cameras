const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8001',
      changeOrigin: true,
      logLevel: 'debug',
      onProxyReq: (proxyReq, req, res) => {
        console.log('[Proxy]', req.method, req.url, '→', 'http://localhost:8001' + req.url);
      },
      onError: (err, req, res) => {
        console.error('[Proxy Error]', err.message);
        res.writeHead(500, {
          'Content-Type': 'application/json',
        });
        res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
      },
    })
  );
};
