const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const config = require('../config/config');

const userSchema = new mongoose.Schema({
    // Identificación
    userId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    email: {
        type: String,
        sparse: true,
        lowercase: true,
        trim: true
    },
    
    // Wallets
    wallets: [{
        address: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ['dogecoin', 'metamask', 'trustwallet', 'bsc'],
            required: true
        },
        isPrimary: {
            type: Boolean,
            default: false
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    
    // Balances
    balance: {
        available: {
            type: Number,
            default: 0
        },
        pending: {
            type: Number,
            default: 0
        },
        totalEarned: {
            type: Number,
            default: 0
        },
        totalWithdrawn: {
            type: Number,
            default: 0
        }
    },
    
    // Estadísticas
    stats: {
        totalEarnings: {
            type: Number,
            default: 0
        },
        todayEarnings: {
            type: Number,
            default: 0
        },
        lastEarningDate: Date,
        totalWithdrawals: {
            type: Number,
            default: 0
        },
        totalTransactions: {
            type: Number,
            default: 0
        },
        referralCount: {
            type: Number,
            default: 0
        },
        bandwidthShared: {
            type: Number,
            default: 0
        },
        miningTime: {
            type: Number,
            default: 0
        }
    },
    
    // Referidos
    referral: {
        code: {
            type: String,
            unique: true,
            sparse: true
        },
        referredBy: String,
        referredUsers: [{
            userId: String,
            joinedAt: Date,
            totalEarnings: Number
        }],
        totalReferralEarnings: {
            type: Number,
            default: 0
        }
    },
    
    // Seguridad
    security: {
        passwordHash: String,
        twoFactorEnabled: {
            type: Boolean,
            default: false
        },
        twoFactorSecret: String,
        withdrawalPin: String,
        lastLoginAt: Date,
        lastLoginIp: String
    },
    
    // Límites y restricciones
    limits: {
        dailyWithdrawalLimit: {
            type: Number,
            default: config.withdrawal.dailyLimit
        },
        dailyWithdrawn: {
            type: Number,
            default: 0
        },
        lastWithdrawalReset: Date
    },
    
    // Configuración
    settings: {
        notifications: {
            email: { type: Boolean, default: true },
            withdrawal: { type: Boolean, default: true },
            earnings: { type: Boolean, default: true }
        },
        autoWithdraw: {
            enabled: { type: Boolean, default: false },
            threshold: Number,
            address: String
        },
        language: {
            type: String,
            default: 'es'
        }
    },
    
    // Metadata
    metadata: {
        ipAddress: String,
        userAgent: String,
        country: String,
        registrationSource: String
    },
    
    // Estado
    status: {
        type: String,
        enum: ['active', 'suspended', 'banned', 'pending'],
        default: 'active'
    },
    
    // Verificación
    verification: {
        emailVerified: {
            type: Boolean,
            default: false
        },
        kycVerified: {
            type: Boolean,
            default: false
        },
        kycLevel: {
            type: Number,
            default: 0
        }
    }
}, {
    timestamps: true,
    collection: 'users'
});

// Índices
userSchema.index({ 'wallets.address': 1 });
userSchema.index({ 'referral.code': 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ status: 1 });

// Métodos de instancia
userSchema.methods.addWallet = function(address, type) {
    const existingWallet = this.wallets.find(w => w.address === address);
    if (existingWallet) {
        throw new Error('Esta wallet ya está agregada');
    }
    
    this.wallets.push({
        address,
        type,
        isPrimary: this.wallets.length === 0
    });
    
    return this.save();
};

userSchema.methods.updateBalance = function(amount, type = 'add') {
    if (type === 'add') {
        this.balance.available += amount;
        this.balance.totalEarned += amount;
        this.stats.totalEarnings += amount;
        this.stats.todayEarnings += amount;
        this.stats.lastEarningDate = new Date();
    } else if (type === 'subtract') {
        this.balance.available -= amount;
        this.balance.totalWithdrawn += amount;
    }
    
    return this.save();
};

userSchema.methods.canWithdraw = function(amount) {
    // Verificar estado de cuenta
    if (this.status !== 'active') {
        return { allowed: false, reason: 'Cuenta no activa' };
    }
    
    // Verificar balance
    if (this.balance.available < amount) {
        return { allowed: false, reason: 'Saldo insuficiente' };
    }
    
    // Verificar límite diario
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (!this.limits.lastWithdrawalReset || this.limits.lastWithdrawalReset < today) {
        this.limits.dailyWithdrawn = 0;
        this.limits.lastWithdrawalReset = today;
    }
    
    if (this.limits.dailyWithdrawn + amount > this.limits.dailyWithdrawalLimit) {
        return { 
            allowed: false, 
            reason: `Límite diario excedido. Límite: ${this.limits.dailyWithdrawalLimit} DOGE` 
        };
    }
    
    return { allowed: true };
};

userSchema.methods.recordWithdrawal = function(amount) {
    this.limits.dailyWithdrawn += amount;
    this.stats.totalWithdrawals += 1;
    return this.save();
};

userSchema.methods.generateReferralCode = function() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.referral.code = code;
    return this.save();
};

userSchema.methods.hashPassword = async function(password) {
    const hash = await bcrypt.hash(password, config.security.bcryptRounds);
    this.security.passwordHash = hash;
    return this.save();
};

userSchema.methods.verifyPassword = async function(password) {
    if (!this.security.passwordHash) return false;
    return await bcrypt.compare(password, this.security.passwordHash);
};

// Métodos estáticos
userSchema.statics.findByWallet = function(address) {
    return this.findOne({ 'wallets.address': address });
};

userSchema.statics.findByReferralCode = function(code) {
    return this.findOne({ 'referral.code': code });
};

userSchema.statics.getLeaderboard = function(limit = 10) {
    return this.find({ status: 'active' })
        .sort({ 'stats.totalEarnings': -1 })
        .limit(limit)
        .select('userId stats.totalEarnings stats.totalWithdrawals');
};

const User = mongoose.model('User', userSchema);

module.exports = User;
