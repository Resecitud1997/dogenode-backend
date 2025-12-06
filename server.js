require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const config = require('./config/config');

// Importar rutas
const walletRoutes = require('./routes/wallet');
const withdrawRoutes = require('./routes/withdraw');
const transactionsRoutes = require('./routes/transactions');

// Importar servicios
const dogecoinNode = require('./services/dogecoinNode');
const dogechainAPI = require('./services/dogechainAPI');
const wrappedDoge = require('./services/wrappedDoge');

const app = express();
const PORT = config.server.port;

// ========================
// MIDDLEWARES DE SEGURIDAD
// ========================

// Helmet para headers de seguridad
app.use(helmet());

// CORS
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: config.security.rateLimitWindow,
    max: config.security.rateLimitMax,
    message: {
        success: false,
        error: 'Demasiadas peticiones, intenta más tarde'
    },
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/', limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logger
if (config.server.environment === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// ========================
// CONEXIÓN A MONGODB
// ========================

mongoose.connect(config.mongodb.uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('✅ Conectado a MongoDB');
})
.catch((error) => {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
});

// ========================
// HEALTH CHECK
// ========================

app.get('/health', (req, res) => {
    const services = {
        mongodb: mongoose.connection.readyState === 1,
        dogecoinNode: dogecoinNode.isAvailable(),
        dogechainAPI: dogechainAPI.isAvailable(),
        wrappedDoge: wrappedDoge.isAvailable()
    };
    
    const isHealthy = services.mongodb;
    
    res.status(isHealthy ? 200 : 503).json({
        success: isHealthy,
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services,
        environment: config.server.environment
    });
});

// ========================
// PÁGINA PRINCIPAL
// ========================

app.get('/', (req, res) => {
    res.json({
        success: true,
        name: 'DogeNode Backend API',
        version: '1.0.0',
        status: 'running',
        message: 'API de pagos reales de Dogecoin',
        endpoints: {
            health: '/health',
            wallet: {
                connect: 'POST /api/wallet/connect',
                balance: 'GET /api/wallet/balance/:userId',
                earnings: 'POST /api/wallet/earnings/add',
                info: 'GET /api/wallet/info/:address',
                stats: 'GET /api/wallet/stats/:userId'
            },
            withdraw: {
                request: 'POST /api/withdraw/request',
                status: 'GET /api/withdraw/status/:transactionId',
                retry: 'POST /api/withdraw/retry/:transactionId',
                estimate: 'GET /api/withdraw/estimate'
            },
            transactions: {
                list: 'GET /api/transactions/:userId',
                details: 'GET /api/transactions/details/:transactionId',
                recent: 'GET /api/transactions/recent/all',
                stats: 'GET /api/transactions/stats/global'
            }
        },
        services: {
            dogecoinNode: dogecoinNode.isAvailable() ? '✅ Disponible' : '❌ No disponible',
            dogechainAPI: dogechainAPI.isAvailable() ? '✅ Disponible' : '❌ No disponible',
            wrappedDoge: wrappedDoge.isAvailable() ? '✅ Disponible' : '❌ No disponible'
        },
        documentation: 'https://github.com/tu-usuario/dogenode'
    });
});

// ========================
// RUTAS API
// ========================

app.use('/api/wallet', walletRoutes);
app.use('/api/withdraw', withdrawRoutes);
app.use('/api/transactions', transactionsRoutes);

// ========================
// RUTA DE PRECIO DOGE
// ========================

app.get('/api/price/doge', async (req, res) => {
    try {
        const price = await dogechainAPI.getDogecoinPrice();
        res.json({
            success: true,
            data: {
                price,
                currency: 'USD',
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error obteniendo precio'
        });
    }
});

// ========================
// RUTA DE ESTADÍSTICAS
// ========================

app.get('/api/stats', async (req, res) => {
    try {
        const User = require('./models/User');
        const Transaction = require('./models/Transaction');
        
        const [totalUsers, activeUsers, totalTransactions, totalDistributed] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({
                'stats.lastEarningDate': {
                    $gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                }
            }),
            Transaction.countDocuments({ status: 'completed' }),
            Transaction.aggregate([
                {
                    $match: { 
                        type: { $in: ['earning', 'withdrawal', 'referral', 'bonus'] },
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$netAmount' }
                    }
                }
            ])
        ]);
        
        res.json({
            success: true,
            data: {
                totalUsers,
                activeUsers,
                totalTransactions,
                totalDistributed: totalDistributed[0]?.total || 0,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener estadísticas'
        });
    }
});

// ========================
// ERROR HANDLERS
// ========================

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint no encontrado',
        path: req.path,
        method: req.method
    });
});

// Error Handler Global
app.use((err, req, res, next) => {
    console.error('Error global:', err);
    
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Error interno del servidor',
        ...(config.server.environment === 'development' && { 
            stack: err.stack,
            details: err 
        })
    });
});

// ========================
// TAREAS PROGRAMADAS
// ========================

// Verificar transacciones pendientes cada 5 minutos
setInterval(async () => {
    try {
        const Transaction = require('./models/Transaction');
        const pendingTransactions = await Transaction.find({
            status: 'pending',
            createdAt: {
                $lt: new Date(Date.now() - 5 * 60 * 1000) // Más de 5 minutos
            }
        }).limit(10);
        
        console.log(`🔍 Verificando ${pendingTransactions.length} transacciones pendientes...`);
        
        for (const tx of pendingTransactions) {
            // Lógica de reintento o notificación
            console.log(`⚠️ Transacción pendiente: ${tx.txId}`);
        }
        
    } catch (error) {
        console.error('Error verificando transacciones pendientes:', error);
    }
}, 5 * 60 * 1000);

// Resetear límites diarios a medianoche
setInterval(async () => {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
        try {
            const User = require('./models/User');
            await User.updateMany({}, {
                $set: {
                    'limits.dailyWithdrawn': 0,
                    'limits.lastWithdrawalReset': new Date()
                }
            });
            console.log('🔄 Límites diarios reseteados');
        } catch (error) {
            console.error('Error reseteando límites:', error);
        }
    }
}, 60 * 1000); // Verificar cada minuto

// ========================
// INICIAR SERVIDOR
// ========================

app.listen(PORT, () => {
    console.log('=================================');
    console.log('🚀 DogeNode Backend API');
    console.log('=================================');
    console.log(`✅ Servidor corriendo en puerto ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`🔒 Ambiente: ${config.server.environment}`);
    console.log('');
    console.log('📊 Servicios:');
    console.log(`   Dogecoin Node: ${dogecoinNode.isAvailable() ? '✅' : '❌'}`);
    console.log(`   Dogechain API: ${dogechainAPI.isAvailable() ? '✅' : '❌'}`);
    console.log(`   Wrapped DOGE: ${wrappedDoge.isAvailable() ? '✅' : '❌'}`);
    console.log('=================================');
});

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});

// Manejo de señales de terminación
process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM recibido, cerrando servidor...');
    await mongoose.connection.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 SIGINT recibido, cerrando servidor...');
    await mongoose.connection.close();
    process.exit(0);
});

module.exports = app;
