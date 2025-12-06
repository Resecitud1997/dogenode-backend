// index.js (Adaptado para Cloudflare Workers)

// 1. ELIMINAR dependencia de Node.js (dotenv)
// En Cloudflare Workers, las variables se inyectan globalmente (como env.VARIABLE).
// require('dotenv').config(); // <-- ELIMINADO

// 2. Importaciones necesarias (Express, CORS, RateLimit y el ADAPTADOR)
const express = require('express');
const cors = require('cors');
// Middleware de seguridad y logging (Helmet, Morgan, etc.)
// Nota: helmet y morgan no son 100% compatibles o son innecesarios en Workers. 
// Usaremos opciones más ligeras o las eliminaremos.
const rateLimit = require('express-rate-limit');
const { handle } = require('@hono/node-server/cloudflare'); // Importa el manejador CRÍTICO

// 3. Importar rutas
// Asegúrate de que las rutas estén en el formato de módulo correcto (require o import ES)
const balanceRoutes = require('./routes/balance');
const earningsRoutes = require('./routes/earnings');
const withdrawRoutes = require('./routes/withdraw');
const transactionsRoutes = require('./routes/transactions');
const healthRoutes = require('./routes/health');

const app = express();
// Cloudflare Workers ignora el puerto; lo gestiona el Edge.
// const PORT = process.env.PORT || 3000; // <-- ELIMINADO

// ========================
// MIDDLEWARES ALIGERADOS
// ========================

// app.use(helmet()); // <--- ELIMINAR/COMENTAR
app.use(cors({ /* ... */ }));

// Rate limiting (se mantiene, funciona con nodejs_compat)
const limiter = rateLimit({ /* ... */ });
app.use('/api/', limiter);

// Body parser - SOLO JSON
app.use(express.json());
// app.use(express.urlencoded({ extended: true })); // <--- COMENTAR/ELIMINAR

// app.use(morgan('combined')); // <--- ELIMINAR/COMENTAR

// ... (RUTAS) ...

// ===================================
// EXPORTACIÓN FINAL (Adaptador)
// ===================================

module.exports = {
    fetch: handle(app),
};

// Rate limiting
// Rate limiting de Express funcionará, pero Cloudflare ofrece Rate Limiting a nivel de Edge, 
// que es más eficiente. Se mantiene el de Express como capa interna.
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: {
        success: false,
        error: 'Demasiadas peticiones, intenta más tarde'
    }
});
app.use('/api/', limiter);

// Body parser
// Express.urlencoded puede fallar sin un módulo compatible con Workers; lo mantenemos simple.
app.use(express.json());
// app.use(express.urlencoded({ extended: true })); // <-- Eliminado/Comentado por posible incompatibilidad

// Logger (Morgan): Morgan es muy dependiente de Node.js. 
// Cloudflare Workers ya tiene logging de peticiones; se elimina.
// app.use(morgan('combined')); // <-- ELIMINADO

// ========================
// RUTAS
// ========================

// Página principal
app.get('/', (req, res) => {
    // ... (Tu objeto de respuesta de bienvenida)
    res.json({
        success: true,
        message: 'DogeNode Backend API',
        version: '2.0.0',
        status: 'Tu servidor está funcionando correctamente',
        // ...
    });
});

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/balance', balanceRoutes);
app.use('/api/earnings', earningsRoutes);
app.use('/api/withdraw', withdrawRoutes);
app.use('/api/transactions', transactionsRoutes);

// ========================
// ERROR HANDLERS (Funcionan bien con Express)
// ========================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint no encontrado',
        path: req.path
    });
});

app.use((err, req, res, next) => {
    // console.error() funciona en Cloudflare, enviando el log a la consola del Worker
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Error interno del servidor',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ===================================
// INICIAR SERVIDOR: EL CAMBIO CRÍTICO
// ===================================

// 1. Eliminar app.listen() y manejo de errores de proceso de Node.js.
// app.listen(PORT, ...) // <-- ELIMINADO
// process.on('unhandledRejection', ...) // <-- ELIMINADO

// 2. Exportar el manejador fetch que requiere Cloudflare Workers.
// Esto envuelve toda tu aplicación Express para que se ejecute en el entorno V8.
module.exports = {
    fetch: handle(app),
};
