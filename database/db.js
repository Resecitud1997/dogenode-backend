// Base de datos en memoria (En producción usar MongoDB/PostgreSQL)
class Database {
  constructor() {
    this.users = new Map();
    this.transactions = [];
    this.earnings = new Map();
  }

  // ==================
  // USUARIOS
  // ==================
  
  getUser(address) {
    if (!this.users.has(address)) {
      this.users.set(address, {
        address: address,
        balance: 0,
        totalEarnings: 0,
        withdrawals: 0,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      });
    }
    return this.users.get(address);
  }

  updateUser(address, data) {
    const user = this.getUser(address);
    const updated = { ...user, ...data, lastActivity: new Date().toISOString() };
    this.users.set(address, updated);
    return updated;
  }

  getAllUsers() {
    return Array.from(this.users.values());
  }

  // ==================
  // TRANSACCIONES
  // ==================
  
  addTransaction(transaction) {
    const tx = {
      id: this.transactions.length + 1,
      ...transaction,
      createdAt: new Date().toISOString()
    };
    this.transactions.push(tx);
    return tx;
  }

  getTransactionsByAddress(address) {
    return this.transactions.filter(
      tx => tx.fromAddress === address || tx.toAddress === address
    );
  }

  getTransactionByHash(txHash) {
    return this.transactions.find(tx => tx.txHash === txHash);
  }

  getAllTransactions() {
    return this.transactions;
  }

  // ==================
  // GANANCIAS
  // ==================
  
  addEarnings(address, amount) {
    const user = this.getUser(address);
    user.balance += amount;
    user.totalEarnings += amount;
    this.updateUser(address, user);
    
    // Registrar en historial de ganancias
    if (!this.earnings.has(address)) {
      this.earnings.set(address, []);
    }
    
    this.earnings.get(address).push({
      amount: amount,
      timestamp: new Date().toISOString()
    });
    
    return user;
  }

  getEarningsHistory(address) {
    return this.earnings.get(address) || [];
  }

  // ==================
  // ESTADÍSTICAS
  // ==================
  
  getStats() {
    const users = this.getAllUsers();
    const transactions = this.getAllTransactions();
    
    return {
      totalUsers: users.length,
      totalTransactions: transactions.length,
      totalVolume: transactions.reduce((sum, tx) => sum + tx.amount, 0),
      activeUsers: users.filter(u => {
        const lastActivity = new Date(u.lastActivity);
        const now = new Date();
        const diffHours = (now - lastActivity) / (1000 * 60 * 60);
        return diffHours < 24;
      }).length
    };
  }

  // Limpiar datos (útil para testing)
  clear() {
    this.users.clear();
    this.transactions = [];
    this.earnings.clear();
  }
}

// Singleton instance
const db = new Database();

module.exports = db;
