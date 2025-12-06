require('dotenv').config();

module.exports = {
    // Configuración del servidor
    server: {
        port: process.env.PORT || 3000,
        environment: process.env.NODE_ENV || 'development'
    },

    // Configuración de MongoDB
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/dogenode'
    },

    // Configuración de JWT
    jwt: {
        secret: process.env.JWT_SECRET || 'your-super-secret-key-change-this',
        expiresIn: '7d'
    },

    // Configuración de Dogecoin Core Node
    dogecoin: {
        enabled: process.env.DOGECOIN_NODE_ENABLED === 'true',
        host: process.env.DOGECOIN_HOST || 'localhost',
        port: process.env.DOGECOIN_PORT || 22555,
        username: process.env.DOGECOIN_USER || 'dogecoinrpc',
        password: process.env.DOGECOIN_PASS || 'your-rpc-password',
        network: process.env.DOGECOIN_NETWORK || 'mainnet', // mainnet o testnet
        minConfirmations: 6,
        feePerKb: 1000000 // 0.01 DOGE por KB
    },

    // Configuración de Dogechain API
    dogechain: {
        enabled: process.env.DOGECHAIN_ENABLED === 'true',
        apiUrl: 'https://dogechain.info/api/v1',
        timeout: 10000
    },

    // Configuración de Wrapped DOGE (BSC)
    wrappedDoge: {
        enabled: process.env.WRAPPED_DOGE_ENABLED === 'true',
        rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
        contractAddress: process.env.WDOGE_CONTRACT || '0x...', // Tu contrato de wDOGE
        privateKey: process.env.WALLET_PRIVATE_KEY || '',
        gasPrice: '5', // Gwei
        gasLimit: 100000
    },

    // Configuración de retiros
    withdrawal: {
        minAmount: 10, // Mínimo 10 DOGE
        maxAmount: 10000, // Máximo 10,000 DOGE por transacción
        feeFixed: 1, // Fee fijo de 1 DOGE
        feePercent: 0, // Fee adicional en porcentaje (0%)
        dailyLimit: 50000, // Límite diario por usuario
        requireConfirmation: true,
        confirmationEmail: false
    },

    // Configuración de seguridad
    security: {
        rateLimitWindow: 15 * 60 * 1000, // 15 minutos
        rateLimitMax: 100, // Máximo 100 requests por ventana
        bcryptRounds: 10
    }
};
