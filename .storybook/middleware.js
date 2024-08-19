const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function expressMiddleware(router) {
    router.use(
        '/api',
        createProxyMiddleware({
            target: 'http://casavaquero.local/api',
            changeOrigin: true,
            pathRewrite: {
                '^/api': ''
            }
        })
    );
};
