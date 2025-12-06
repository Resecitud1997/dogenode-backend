detectBackendURL() {
    if (window.location.hostname === 'localhost') {
        return 'http://localhost:3000';
    }
    
    // URL de producción
    return 'https://tu-backend.herokuapp.com';
}
```

## Flujo de Datos

### Conectar Wallet
```
Frontend → POST /api/wallet/connect
         ← { success: true, data: { userId, address, balance } }
```

### Agregar Ganancias
```
Frontend → POST /api/wallet/earnings/add
         ← { success: true, data: { newBalance } }
```

### Solicitar Retiro
```
Frontend → POST /api/withdraw/request
         ← { success: true, data: { transactionId, status } }
         
Frontend → GET /api/withdraw/status/:txId (polling cada 15s)
         ← { success: true, data: { status: 'completed', txHash } }
