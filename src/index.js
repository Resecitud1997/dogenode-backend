// src/index.js (Hono: Código Nativo de Cloudflare Worker)

// 1. Importaciones de Hono y Módulos
import { Hono } from 'hono';
import { cors } from 'hono/cors'; // Middleware CORS de Hono
import { rateLimiter } from 'hono-rate-limiter'; // Middleware Rate Limit
// Si tus rutas usan el formato module.exports = router, tendrás que reescribirlas.
// Asumo que ahora usarás un patrón de rutas modular más compatible.

// 2. Aplicación y Configuración
const app = new Hono();

// ========================
// MIDDLEWARES DE SEGURIDAD (Hono)
// ========================

// CORS (nativo de Hono)
app.use('*', cors({
    origin: process.env.CORS_ORIGIN || '*', 
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['POST', 'GET', 'OPTIONS'],
}));

// Rate limiting (Usando la librería de Hono, ahora instalada)
const limiter = rateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    standardHeaders: true,
    keyGenerator: (c) => c.env.IP || 'global',
    message: { success: false, error: 'Demasiadas peticiones, intenta más tarde' }
});
app.use(limiter);

// Body parser
app.use('*', async (c, next) => {
    // Hono ya maneja el parseo de JSON, no se necesita body-parser
    await next();
});

// ========================
// RUTAS PRINCIPALES (Hono)
// ========================

// Página principal
app.get('/', (c) => {
    return c.json({
        success: true,
        message: 'DogeNode Backend API (Hono Native)',
        version: '2.0.0',
        status: 'Servidor corriendo en Cloudflare Workers',
        // ... (resto de metadata)
    });
});

// Nota: Para usar tus archivos de ruta existentes, deberás reescribirlos a la sintaxis de Hono.
// Por ahora, para el despliegue, comentamos la importación de rutas.
// app.route('/api/health', healthRoutes); 
// app.route('/api/balance', balanceRoutes); 
// ...

// ========================
// ERROR HANDLERS (Hono)
// ========================

// 404 Handler de Hono
app.notFound((c) => {
  return c.json({ success: false, error: 'Endpoint no encontrado', path: c.req.url }, 404);
});

// Error Handler Global de Hono
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ 
    success: false, 
    error: err.message || 'Error interno del servidor',
    ...(c.env.NODE_ENV === 'development' && { stack: err.stack })
  }, 500);
});

// ===================================
// EXPORTACIÓN DE WORKER (Hono)
// ===================================

// Hono se exporta directamente como el manejador fetch.
export default app;
