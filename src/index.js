// src/index.js (Formato ES Module y Hono)

// La sintaxis 'require' falla con "type": "module". Usamos 'import'.
import { Hono } from 'hono';
import { cors } from 'hono/cors'; // Soluciona "Could not resolve 'hono/cors'"
import { rateLimiter } from 'hono-rate-limiter'; // Soluciona "Could not resolve 'hono-rate-limiter'"
import { json } from 'hono/json';

// Si tus rutas usan el formato CommonJS (require/module.exports), necesitarás adaptarlas.
// Por ahora, para el despliegue, omitimos la importación de rutas.

const app = new Hono();

// ========================
// MIDDLEWARES
// ========================

app.use('*', cors({
    origin: process.env.CORS_ORIGIN || '*', 
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['POST', 'GET', 'OPTIONS'],
}));

const limiter = rateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    standardHeaders: true,
    keyGenerator: (c) => c.env.IP || 'global',
    message: { success: false, error: 'Demasiadas peticiones, intenta más tarde' }
});
app.use(limiter);

app.use(json()); 

// ========================
// RUTAS MÍNIMAS PARA PRUEBA
// ========================

app.get('/', (c) => {
    return c.json({
        success: true,
        message: 'DogeNode Backend API (Hono Native)',
        version: '2.0.0',
        status: 'Servidor listo para Workers',
    });
});

// ========================
// ERROR HANDLERS (Hono)
// ========================

app.notFound((c) => {
  return c.json({ success: false, error: 'Endpoint no encontrado' }, 404);
});

// ===================================
// EXPORTACIÓN DE WORKER
// ===================================

export default app; // Soluciona el error de "no default export"
