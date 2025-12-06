// src/index.js (Hono: Código Nativo de Cloudflare Worker y ES Module)

import { Hono } from 'hono';
import { cors } from 'hono/cors'; 
import { json } from 'hono/json';
import { rateLimiter } from 'hono-rate-limiter'; // Librería más estable que la anterior

// Nota: Necesitas convertir tus archivos de rutas (balance, earnings, etc.) 
// a la sintaxis de Hono o importarlos con import.

const app = new Hono();

// ========================
// MIDDLEWARES (Hono)
// ========================

// CORS
app.use(cors({
    origin: (origin) => (origin === process.env.CORS_ORIGIN || origin === 'null' ? origin : '*'),
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['POST', 'GET', 'OPTIONS'],
}));

// Body parser (Hono lo maneja por defecto, pero usamos este middleware para asegurar JSON)
app.use(json());

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
    });
});

// Nota: Las rutas deben ser reescritas a Hono:
// app.route('/api/health', healthRouter); 

// ========================
// ERROR HANDLERS (Hono)
// ========================

app.notFound((c) => {
  // Manejo de 404
  return c.json({ success: false, error: 'Endpoint no encontrado', path: c.req.url }, 404);
});

app.onError((err, c) => {
  // Manejo de errores globales
  console.error('Error:', err);
  return c.json({ 
    success: false, 
    error: err.message || 'Error interno del servidor',
  }, 500);
});

// ===================================
// EXPORTACIÓN DE WORKER (Formato ES Module)
// ===================================

export default app; // Soluciona el error de "no default export"
