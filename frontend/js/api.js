// Cliente API para comunicarse con el backend
class API {
    constructor() {
        // URL del backend - CAMBIAR EN PRODUCCIÓN
        this.baseURL = this.detectBackendURL();
        this.timeout = 30000; // 30 segundos
    }

    // Detectar URL del backend automáticamente
    detectBackendURL() {
        // Si estás en localhost, usar backend local
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:3000';
        }
        
        // Si estás en GitHub Pages, usar tu backend deployado
        // CAMBIAR ESTO POR TU URL REAL DE BACKEND
        return 'https://tu-backend.herokuapp.com'; // O tu dominio
    }

    // Hacer request HTTP
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const config = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (options.body && config.method !== 'GET') {
            config.body = JSON.stringify(options.body);
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            const response = await fetch(url, {
                ...config,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error en la petición');
            }

            return data;

        } catch (error) {
            console.error('API Error:', error);
            
            if (error.name === 'AbortError') {
                throw new Error('Tiempo de espera agotado');
            }
            
            throw error;
        }
    }

    // ==================
    // WALLET ENDPOINTS
    // ==================

    async connectWallet(userId, address, type) {
        return await this.request('/api/wallet/connect', {
            method: 'POST',
            body: { userId, address, type }
        });
    }

    async getBalance(userId) {
        return await this.request(`/api/wallet/balance/${userId}`);
    }

    async addEarnings(userId, amount, source = 'mining') {
        return await this.request('/api/wallet/earnings/add', {
            method: 'POST',
            body: { userId, amount, source }
        });
    }

    async getWalletInfo(address) {
        return await this.request(`/api/wallet/info/${address}`);
    }

    async getUserStats(userId) {
        return await this.request(`/api/wallet/stats/${userId}`);
    }

    // ==================
    // WITHDRAWAL ENDPOINTS
    // ==================

    async requestWithdrawal(userId, toAddress, amount, method = 'auto') {
        return await this.request('/api/withdraw/request', {
            method: 'POST',
            body: { userId, toAddress, amount, method }
        });
    }

    async getWithdrawalStatus(transactionId) {
        return await this.request(`/api/withdraw/status/${transactionId}`);
    }

    async retryWithdrawal(transactionId) {
        return await this.request(`/api/withdraw/retry/${transactionId}`, {
            method: 'POST'
        });
    }

    async estimateWithdrawal(amount, method = 'dogecoin_node') {
        return await this.request(`/api/withdraw/estimate?amount=${amount}&method=${method}`);
    }

    // ==================
    // TRANSACTIONS ENDPOINTS
    // ==================

    async getTransactions(userId, options = {}) {
        const params = new URLSearchParams(options).toString();
        return await this.request(`/api/transactions/${userId}?${params}`);
    }

    async getTransactionDetails(transactionId) {
        return await this.request(`/api/transactions/details/${transactionId}`);
    }

    async getRecentTransactions(limit = 20) {
        return await this.request(`/api/transactions/recent/all?limit=${limit}`);
    }

    async getGlobalStats() {
        return await this.request('/api/transactions/stats/global');
    }

    // ==================
    // OTROS ENDPOINTS
    // ==================

    async getDogePrice() {
        return await this.request('/api/price/doge');
    }

    async getStats() {
        return await this.request('/api/stats');
    }

    async healthCheck() {
        return await this.request('/health');
    }
}

// Crear instancia global
const api = new API();

// Exportar para uso en otros archivos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}

console.log('🌐 API Client inicializado:', api.baseURL);
