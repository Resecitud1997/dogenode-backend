const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    // Identificación
    txId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
    // Usuario
    userId: {
        type: String,
        required: true,
        index: true
    },
    
    // Tipo de transacción
    type: {
        type: String,
        enum: ['earning', 'withdrawal', 'referral', 'bonus', 'refund'],
        required: true,
        index: true
    },
    
    // Método de pago
    method: {
        type: String,
        enum: ['dogecoin_node', 'dogechain_api', 'wrapped_doge', 'manual'],
        required: true
    },
    
    // Detalles de la transacción
    amount: {
        type: Number,
        required: true
    },
    
    fee: {
        type: Number,
        default: 0
    },
    
    netAmount: {
        type: Number,
        required: true
    },
    
    // Direcciones
    fromAddress: String,
    toAddress: String,
    
    // Estado
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
        default: 'pending',
        index: true
    },
    
    // Blockchain data
    blockchain: {
        txHash: String,
        blockHeight: Number,
        confirmations: {
            type: Number,
            default: 0
        },
        explorerUrl: String,
        network: String // mainnet, testnet, bsc
    },
    
    // Metadata
    metadata: {
        description: String,
        referralCode: String,
        ipAddress: String,
        userAgent: String,
        notes: String
    },
    
    // Timestamps
    processedAt: Date,
    completedAt: Date,
    
    // Errores
    error: {
        message: String,
        code: String,
        details: mongoose.Schema.Types.Mixed
    },
    
    // Reintentos
    retries: {
        type: Number,
        default: 0
    },
    
    lastRetryAt: Date
}, {
    timestamps: true,
    collection: 'transactions'
});

// Índices compuestos
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ 'blockchain.txHash': 1 });

// Métodos de instancia
transactionSchema.methods.markAsProcessing = function() {
    this.status = 'processing';
    this.processedAt = new Date();
    return this.save();
};

transactionSchema.methods.markAsCompleted = function(txHash, explorerUrl) {
    this.status = 'completed';
    this.completedAt = new Date();
    this.blockchain.txHash = txHash;
    this.blockchain.explorerUrl = explorerUrl;
    return this.save();
};

transactionSchema.methods.markAsFailed = function(errorMessage, errorCode) {
    this.status = 'failed';
    this.error = {
        message: errorMessage,
        code: errorCode,
        details: {}
    };
    return this.save();
};

transactionSchema.methods.retry = function() {
    this.retries += 1;
    this.lastRetryAt = new Date();
    this.status = 'pending';
    return this.save();
};

transactionSchema.methods.updateConfirmations = function(confirmations) {
    this.blockchain.confirmations = confirmations;
    return this.save();
};

// Métodos estáticos
transactionSchema.statics.findByUser = function(userId, options = {}) {
    const { type, status, limit = 50, skip = 0 } = options;
    
    const query = { userId };
    if (type) query.type = type;
    if (status) query.status = status;
    
    return this.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);
};

transactionSchema.statics.findPending = function() {
    return this.find({ status: 'pending' })
        .sort({ createdAt: 1 });
};

transactionSchema.statics.getUserStats = async function(userId) {
    const stats = await this.aggregate([
        { $match: { userId, status: 'completed' } },
        {
            $group: {
                _id: '$type',
                total: { $sum: '$netAmount' },
                count: { $sum: 1 }
            }
        }
    ]);
    
    return stats.reduce((acc, stat) => {
        acc[stat._id] = {
            total: stat.total,
            count: stat.count
        };
        return acc;
    }, {});
};

transactionSchema.statics.getRecentWithdrawals = function(limit = 10) {
    return this.find({ 
        type: 'withdrawal', 
        status: 'completed' 
    })
    .sort({ completedAt: -1 })
    .limit(limit)
    .select('userId amount completedAt blockchain.txHash');
};

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
