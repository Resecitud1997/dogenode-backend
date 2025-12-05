const express = express();
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Base de datos temporal (en producción usa MongoDB, PostgreSQL, etc.)
const users = {};
const transactions = [];

// Endpoint: Obtener balance
app.get('/api/balance/:address', (req, res) => {
    const { address } = req.params;
    
    if (!users[address]) {
        users[address] = { balance: 0, earnings: 0 };
    }
    
    res.json({
        success: true,
        balance: users[address].balance,
        address: address
    });
});

// Endpoint: Actualizar ganancias
app.post('/api/earnings', (req, res) => {
    const { address, amount } = req.body;
    
    if (!users[address]) {
        users[address] = { balance: 0, earnings: 0 };
    }
    
    users[address].balance += amount;
    users[address].earnings += amount;
    
    res.json({
        success: true,
        newBalance: users[address].balance
    });
});

// Endpoint: Procesar retiro
app.post('/api/withdraw', async (req, res) => {
    const { from Address, toAddress, amount } = req.body;
    
    // Validaciones
    if (!fromAddress || !toAddress || !amount) {
        return res.status(400).json({
            success: false,
            error: 'Faltan parámetros'
        });
    }
    
    if (amount < 10) {
        return res.status(400).json({
            success: false,
            error: 'Mínimo de retiro: 10 DOGE'
        });
    }
    
    if (!users[fromAddress] || users[fromAddress].balance < amount) {
        return res.status(400).json({
            success: false,
            error: 'Saldo insuficiente'
        });
    }
    
    // Simular procesamiento de transacción
    // En producción, aquí conectarías con Dogecoin Core o una API
    const txHash = generateTxHash();
    
    // Actualizar balance
    users[fromAddress].balance -= amount;
    
    // Guardar transacción
    transactions.push({
        id: transactions.length + 1,
        from: fromAddress,
        to: toAddress,
        amount: amount,
        txHash: txHash,
        status: 'completed',
        timestamp: new Date().toISOString()
    });
    
    res.json({
        success: true,
        txHash: txHash,
        newBalance: users[fromAddress].balance,
        explorerUrl: `https://dogechain.info/tx/${txHash}`
    });
});

// Endpoint: Historial de transacciones
app.get('/api/transactions/:address', (req, res) => {
    const { address } = req.params;
    
    const userTransactions = transactions.filter(
        tx => tx.from === address || tx.to === address
    );
    
    res.json({
        success: true,
        transactions: userTransactions
    });
});

// Generar hash de transacción simulado
function generateTxHash() {
    return Array.from({length: 64}, () => 
        Math.floor(Math.random() * 16).toString(16)
    ).join('');
}

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
