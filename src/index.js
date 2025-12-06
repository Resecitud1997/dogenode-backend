// index.js (Reescrito a Hono, nativo de Workers)

// 1. ELIMINAR require('express') y el adapter de hono/node-server
const { Hono } = require('hono');
const { cors } = require('hono/cors'); // Middleware CORS de Hono
const { rateLimiter } = require('hono-rate-limiter'); // Un Rate Limiter ligero

// ... (Importaciones de rutas: Asumimos que tus rutas usan Express Router)

const app = new Hono();

// ========================
// MIDDLEWARES DE Hono
// ========================

// CORS (nativo de Hono)
app.use('*', cors({
    origin: (origin, c) => {
        if (origin === process.env.CORS_ORIGIN || origin === 'null') {
            return origin;
        }
        return c.env.CORS_ORIGIN || '*'; // Usa variables de entorno de Cloudflare
    },
    allowHeaders: ['X-Custom-Header', 'Upgrade-Insecure-Requests'],
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
}));

// Rate limiting (nativo de Hono)
const limiter = rateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    standardHeaders: true,
    keyGenerator: (c) => c.env.IP || 'global',
});

// app.use(limiter); // Aplicamos el limiter

// ========================
// RUTAS PRINCIPALES (Reemplaza app.get por app.get)
// ========================

// Página principal
app.get('/', (c) => {
    return c.json({
        success: true,
        message: 'DogeNode Backend API (Hono)',
        // ... (resto de tu metadata)
    });
});

// APLICAR ROUTERS DE EXPRESS: Esto es lo complicado. 
// Debes reescribir tus routers de Express a Routers de Hono
// o usar un adaptador de Express a Hono (pero eso nos devuelve al problema original).
// La forma profesional es reescribir tus rutas a la sintaxis de Hono.

// EJEMPLO DE ROUTER Hono:
// app.route('/api/health', healthRoutes); // Si healthRoutes es un Hono Router

// ===================================
// EXPORTACIÓN DE WORKER (Sintaxis nativa)
// ===================================

export default app; // Hono se exporta directamente.
