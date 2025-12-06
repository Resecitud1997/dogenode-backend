const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const User = require('../models/User');

// GET /api/transactions/:userId
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { 
            type, 
            status, 
            limit = 50, 
            skip = 0,
            startDate,
            endDate
        } = req.query;
        
        // Construir query
        const query = { userId };
        
        if (type) query.type = type;
        if (status) query.status = status;
        
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }
        
        // Obtener transacciones
        const transactions = await Transaction.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));
        
        // Contar total
        const total = await Transaction.countDocuments(query);
        
        res.json({
            success: true,
            data: {
                transactions: transactions.map(tx => ({
                    id: tx.txId,
                    type: tx.type,
                    method: tx.method,
                    amount: tx.amount,
                    fee: tx.fee,
                    netAmount: tx.netAmount,
                    status: tx.status,
                    toAddress: tx.toAddress,
                    fromAddress: tx.fromAddress,
                    txHash: tx.blockchain?.txHash,
                    confirmations: tx.blockchain?.confirmations,
                    explorerUrl: tx.blockchain?.explorerUrl,
                    createdAt: tx.createdAt,
                    completedAt: tx.completedAt
                })),
                pagination: {
                    total,
                    limit: parseInt(limit),
                    skip: parseInt(skip),
                    hasMore: (parseInt(skip) + parseInt(limit)) < total
                }
            }
        });
        
    } catch (error) {
        console.error('Error obteniendo transacciones:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener transacciones'
        });
    }
});

// GET /api/transactions/details/:transactionId
router.get('/details/:transactionId', async (req, res) => {
    try {
        const { transactionId } = req.params;
        
        const transaction = await Transaction.findOne({ txId: transactionId });
        
        if (!transaction) {
            return res.status(404).json({
                success: false,
                error: 'Transacción no encontrada'
            });
        }
        
        res.json({
            success: true,
            data: {
                id: transaction.txId,
                userId: transaction.userId,
                type: transaction.type,
                method: transaction.method,
                amount: transaction.amount,
                fee: transaction.fee,
                netAmount: transaction.netAmount,
                status: transaction.status,
                fromAddress: transaction.fromAddress,
                toAddress: transaction.toAddress,
                blockchain: transaction.blockchain,
                metadata: transaction.metadata,
                error: transaction.error,
                retries: transaction.retries,
                createdAt: transaction.createdAt,
                processedAt: transaction.processedAt,
                completedAt: transaction.completedAt
            }
        });
        
    } catch (error) {
        console.error('Error obteniendo detalles:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener detalles de la transacción'
        });
    }
});

// GET /api/transactions/recent/all
router.get('/recent/all', async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        
        const transactions = await Transaction.find({ 
            status: 'completed',
            type: { $in: ['withdrawal', 'earning'] }
        })
        .sort({ completedAt: -1 })
        .limit(parseInt(limit))
        .select('userId type amount completedAt blockchain.txHash');
        
        res.json({
            success: true,
            data: transactions.map(tx => ({
                id: tx.txId,
                userId: tx.userId.substring(0, 8) + '...',
                type: tx.type,
                amount: tx.amount,
                txHash: tx.blockchain?.txHash,
                timestamp: tx.completedAt
            }))
        });
        
    } catch (error) {
        console.error('Error obteniendo transacciones recientes:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener transacciones recientes'
        });
    }
});

// GET /api/transactions/stats/global
router.get('/stats/global', async (req, res) => {
    try {
        const stats = await Transaction.aggregate([
            {
                $match: { status: 'completed' }
            },
            {
                $group: {
                    _id: '$type',
                    totalAmount: { $sum: '$netAmount' },
                    count: { $sum: 1 }
                }
            }
        ]);
        
        // Total de usuarios
        const totalUsers = await User.countDocuments();
        
        // Usuarios activos (últimas 24h)
        const activeUsers = await User.countDocuments({
            'stats.lastEarningDate': {
                $gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
        });
        
        // Total distribuido
        const totalDistributed = await Transaction.aggregate([
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
        ]);
        
        res.json({
            success: true,
            data: {
                totalUsers,
                activeUsers,
                totalDistributed: totalDistributed[0]?.total || 0,
                transactions: stats.reduce((acc, stat) => {
                    acc[stat._id] = {
                        total: stat.totalAmount,
                        count: stat.count
                    };
                    return acc;
                }, {})
            }
        });
        
    } catch (error) {
        console.error('Error obteniendo estadísticas globales:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener estadísticas'
        });
    }
});

// POST /api/transactions/webhook/confirmation
router.post('/webhook/confirmation', async (req, res) => {
    try {
        const { txHash, confirmations } = req.body;
        
        if (!txHash) {
            return res.status(400).json({
                success: false,
                error: 'TxHash es requerido'
            });
        }
        
        const transaction = await Transaction.findOne({ 
            'blockchain.txHash': txHash 
        });
        
        if (!transaction) {
            return res.status(404).json({
                success: false,
                error: 'Transacción no encontrada'
            });
        }
        
        await transaction.updateConfirmations(confirmations);
        
        res.json({
            success: true,
            message: 'Confirmaciones actualizadas',
            data: {
                txHash,
                confirmations
            }
        });
        
    } catch (error) {
        console.error('Error en webhook:', error);
        res.status(500).json({
            success: false,
            error: 'Error procesando webhook'
        });
    }
});

module.exports = router;
