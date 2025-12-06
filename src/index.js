// index.js (Versión compatible con Cloudflare Workers)

// 1. ELIMINAR dependencias incompatibles: helmet, morgan.
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { handle } = require('@hono/node-server/cloudflare'); // Adaptador esencial

// 2. Importar rutas (Asegúrate de que estas rutas no usen 'fs' o 'crypto' internamente)
const balanceRoutes = require('./routes/balance');
const earningsRoutes = require('./routes/earnings');
const withdrawRoutes = require('./routes/withdraw');
const transactionsRoutes = require('./routes/transactions');
const healthRoutes = require('./routes/health');

const app = express();
// Se elimina la definición de PORT.

// ========================
// MIDDLEWARES DE SEGURIDAD Y AJUSTES
// ========================

// app.use(helmet()); // <--- ELIMINADO para solucionar el error de módulos nativos

// CORS
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*', 
    credentials: true
}));

// Rate limiting (Debe funcionar con nodejs_compat)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: {
        success: false,
        error: 'Demasiadas peticiones, intenta más tarde'
    }
});
app.use('/api/', limiter);

// Body parser - SOLO JSON
app.use(express.json());
// app.use(express.urlencoded({ extended: true })); // <--- ELIMINADO: Causa error de 'querystring'/'util'

// app.use(morgan('combined')); // <--- ELIMINADO para solucionar el error de 'stream'/'tty'

// ========================
// RUTAS
// ========================

// Página principal
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'DogeNode Backend API',
        version: '2.0.0',
        status: 'Tu servidor está funcionando correctamente',
        endpoints: {
            // ... (Tus endpoints)
        },
        documentation: 'https://dogenode.com/docs'
    });
});

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/balance', balanceRoutes);
app.use('/api/earnings', earningsRoutes);
app.use('/api/withdraw', withdrawRoutes);
app.use('/api/transactions', transactionsRoutes);

// ========================
// ERROR HANDLERS (Permanecen sin cambios)
// ========================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint no encontrado',
        path: req.path
    });
});

app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Error interno del servidor',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ===================================
// EXPORTACIÓN DE WORKER
// ===================================

module.exports = {
    fetch: handle(app), // Envuelve Express para Cloudflare
};
