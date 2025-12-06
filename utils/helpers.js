const crypto = require('crypto');

class Helpers {
    // Generar ID único
    static generateId(prefix = '') {
        const timestamp = Date.now().toString(36);
        const random = crypto.randomBytes(8).toString('hex');
        return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
    }
    
    // Generar hash
    static generateHash(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }
    
    // Validar dirección de Dogecoin
    static isValidDogeAddress(address) {
        if (!address || typeof address !== 'string') return false;
        const dogeRegex = /^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}$/;
        return dogeRegex.test(address);
    }
    
    // Validar dirección Ethereum/BSC
    static isValidEthAddress(address) {
        if (!address || typeof address !== 'string') return false;
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
    
    // Formatear cantidad de DOGE
    static formatDoge(amount, decimals = 8) {
        return parseFloat(amount).toFixed(decimals);
    }
    
    // Convertir DOGE a USD
    static dogeToUSD(dogeAmount, dogePrice) {
        return dogeAmount * dogePrice;
    }
    
    // Convertir USD a DOGE
    static usdToDoge(usdAmount, dogePrice) {
        return usdAmount / dogePrice;
    }
    
    // Calcular fee
    static calculateFee(amount, feePercent = 0, feeFixed = 0) {
        return (amount * feePercent / 100) + feeFixed;
    }
    
    // Validar email
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    // Sanitizar string
    static sanitize(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[<>]/g, '');
    }
    
    // Generar código de referido
    static generateReferralCode(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < length; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
    
    // Formatear fecha
    static formatDate(date) {
        return new Date(date).toISOString();
    }
    
    // Obtener timestamp
    static timestamp() {
        return Math.floor(Date.now() / 1000);
    }
    
    // Sleep/delay
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Retry con backoff exponencial
    static async retry(fn, maxRetries = 3, delay = 1000) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await fn();
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                await this.sleep(delay * Math.pow(2, i));
            }
        }
    }
    
    // Redondear cantidad
    static roundAmount(amount, decimals = 8) {
        return Math.round(amount * Math.pow(10, decimals)) / Math.pow(10, decimals);
    }
    
    // Verificar si es número válido
    static isValidNumber(value) {
        return !isNaN(parseFloat(value)) && isFinite(value) && value > 0;
    }
    
    // Paginar resultados
    static paginate(array, page = 1, limit = 10) {
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        
        return {
            data: array.slice(startIndex, endIndex),
            pagination: {
                page,
                limit,
                total: array.length,
                totalPages: Math.ceil(array.length / limit),
                hasNext: endIndex < array.length,
                hasPrev: startIndex > 0
            }
        };
    }
    
    // Rate limiting check
    static checkRateLimit(requests, windowMs, maxRequests) {
        const now = Date.now();
        const windowStart = now - windowMs;
        
        const recentRequests = requests.filter(req => req > windowStart);
        
        return {
            allowed: recentRequests.length < maxRequests,
            remaining: Math.max(0, maxRequests - recentRequests.length),
            resetAt: new Date(windowStart + windowMs)
        };
    }
}

module.exports = Helpers;
