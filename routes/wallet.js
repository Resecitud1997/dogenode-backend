const express = require('express');
const router = express.Router();
const User = require('../models/User');
const dogecoinNode = require('../services/dogecoinNode');
const dogechainAPI = require('../services/dogechainAPI');
const wrappedDoge = require('../services/wrappedDoge');

// POST /api/wallet/connect
router.post('/connect', async (req, res) => {
    try {
        const { userId, address, type } = req.body;
        
        // Validaciones
        if (!userId || !address || !type) {
            return res.status(400).json({
                success: false,
                error: 'Faltan parámetros requeridos'
            });
        }
        
        // Validar dirección según tipo
        let isValid = false;
        
        if (type === 'dogecoin') {
            if (dogecoinNode.isAvailable()) {
                isValid = await dogecoinNode.validateAddress(address);
            } else if (dogechainAPI.isAvailable()) {
                isValid = await dogechainAPI.validateAddress(address);
            }
        } else if (type === 'bsc' || type === 'metamask') {
            isValid = wrappedDoge.isValidAddress(address);
        }
        
        if (!isValid) {
            return res.status(400).json({
                success: false,
                error: 'Dirección de wallet inválida'
            });
        }
        
        // Buscar o crear usuario
        let user = await User.findOne({ userId });
        
        if (!user) {
            user = new User({
                userId,
                wallets: [],
                referral: {}
            });
            
            // Generar código de referido
            await user.generateReferralCode();
        }
        
        // Agregar wallet
        await user.addWallet(address, type);
        
        res.json({
            success: true,
            message: 'Wallet conectada exitosamente',
            data: {
                userId: user.userId,
                wallet: {
                    address,
                    type
                },
                balance: user.balance.available,
                referralCode: user.referral.code
            }
        });
        
    } catch (error) {
        console.error('Error conectando wallet:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Error al conectar la wallet'
        });
    }
});

// GET /api/wallet/balance/:userId
router.get('/balance/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await User.findOne({ userId });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado'
            });
        }
        
        res.json({
            success: true,
            data: {
                available: user.balance.available,
                pending: user.balance.pending,
                totalEarned: user.balance.totalEarned,
                totalWithdrawn: user.balance.totalWithdrawn
            }
        });
        
    } catch (error) {
        console.error('Error obteniendo balance:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener balance'
        });
    }
});

// POST /api/wallet/earnings/add
router.post('/earnings/add', async (req, res) => {
    try {
        const { userId, amount, source = 'mining' } = req.body;
        
        if (!userId || !amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Parámetros inválidos'
            });
        }
        
        const user = await User.findOne({ userId });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado'
            });
        }
        
        // Actualizar balance
        await user.updateBalance(amount, 'add');
        
        // Crear transacción de ganancia
        const Transaction = require('../models/Transaction');
        const transaction = new Transaction({
            txId: `earning_${Date.now()}_${userId}`,
            userId,
            type: 'earning',
            method: 'manual',
            amount,
            fee: 0,
            netAmount: amount,
            status: 'completed',
            metadata: {
                description: `Ganancias por ${source}`,
                ipAddress: req.ip
            }
        });
        
        await transaction.save();
        
        res.json({
            success: true,
            message: 'Ganancias agregadas exitosamente',
            data: {
                newBalance: user.balance.available,
                totalEarnings: user.stats.totalEarnings,
                transaction: {
                    id: transaction.txId,
                    amount: transaction.amount,
                    timestamp: transaction.createdAt
                }
            }
        });
        
    } catch (error) {
        console.error('Error agregando ganancias:', error);
        res.status(500).json({
            success: false,
            error: 'Error al agregar ganancias'
        });
    }
});

// GET /api/wallet/info/:address
router.get('/info/:address', async (req, res) => {
    try {
        const { address } = req.params;
        
        let balance = 0;
        let transactions = [];
        
        // Intentar obtener info de Dogecoin
        if (address.startsWith('D')) {
            if (dogecoinNode.isAvailable()) {
                balance = await dogecoinNode.getBalance(address);
            } else if (dogechainAPI.isAvailable()) {
                balance = await dogechainAPI.getAddressBalance(address);
                transactions = await dogechainAPI.getAddressTransactions(address);
            }
        }
        // Intentar obtener info de BSC
        else if (wrappedDoge.isAvailable() && wrappedDoge.isValidAddress(address)) {
            balance = await wrappedDoge.getBalance(address);
        }
        
        res.json({
            success: true,
            data: {
                address,
                balance,
                transactions: transactions.slice(0, 10)
            }
        });
        
    } catch (error) {
        console.error('Error obteniendo info de wallet:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener información de la wallet'
        });
    }
});

// GET /api/wallet/stats/:userId
router.get('/stats/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await User.findOne({ userId });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado'
            });
        }
        
        // Obtener estadísticas de transacciones
        const Transaction = require('../models/Transaction');
        const txStats = await Transaction.getUserStats(userId);
        
        res.json({
            success: true,
            data: {
                balance: {
                    available: user.balance.available,
                    totalEarned: user.balance.totalEarned,
                    totalWithdrawn: user.balance.totalWithdrawn
                },
                stats: {
                    totalEarnings: user.stats.totalEarnings,
                    todayEarnings: user.stats.todayEarnings,
                    totalWithdrawals: user.stats.totalWithdrawals,
                    totalTransactions: user.stats.totalTransactions,
                    referralCount: user.stats.referralCount
                },
                transactions: txStats,
                referral: {
                    code: user.referral.code,
                    totalEarnings: user.referral.totalReferralEarnings,
                    referredCount: user.referral.referredUsers.length
                }
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

module.exports = router;
