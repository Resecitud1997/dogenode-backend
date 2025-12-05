const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { successResponse, errorResponse, isValidDogeAddress } = require('../utils/helpers');

// GET /api/transactions/:address
router.get('/:address', (req, res) => {
  try {
    const { address } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    // Validar dirección
    if (!isValidDogeAddress(address)) {
      return res.status(400).json(
        errorResponse('Dirección de Dogecoin inválida')
      );
    }
    
    // Obtener transacciones
    let transactions = db.getTransactionsByAddress(address);
    
    // Ordenar por fecha (más recientes primero)
    transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Paginación
    const total = transactions.length;
    const start = parseInt(offset);
    const end = start + parseInt(limit);
    transactions = transactions.slice(start, end);
    
    res.json(successResponse({
      address,
      transactions,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: end < total
      }
    }, 'Transacciones obtenidas correctamente'));
    
  } catch (error) {
    console.error('Error en transactions:', error);
    res.status(500).json(errorResponse('Error al obtener transacciones', 500));
  }
});

// GET /api/transactions/hash/:txHash
router.get('/hash/:txHash', (req, res) => {
  try {
    const { txHash } = req.params;
    
    const transaction = db.getTransactionByHash(txHash);
    
    if (!transaction) {
      return res.status(404).json(
        errorResponse('Transacción no encontrada', 404)
      );
    }
    
    res.json(successResponse(
      transaction,
      'Transacción encontrada'
    ));
    
  } catch (error) {
    console.error('Error en transaction by hash:', error);
    res.status(500).json(errorResponse('Error al obtener transacción', 500));
  }
});

module.exports = router;
```

### **Archivo 11: `.replit`** (Configuración de Replit)
```
run = "npm start"
entrypoint = "index.js"
language = "nodejs"

[nix]
channel = "stable-22_11"

[deployment]
run = ["node", "index.js"]
deploymentTarget = "cloudrun"
```

---

## 📁 Estructura Final de Carpetas
```
dogenode-backend/
├── index.js
├── package.json
├── .env
├── .replit
├── database/
│   └── db.js
├── routes/
│   ├── health.js
│   ├── balance.js
│   ├── earnings.js
│   ├── withdraw.js
│   └── transactions.js
└── utils/
    └── helpers.js