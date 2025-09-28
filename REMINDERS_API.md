# 📧 API de Recordatorios - ShimliAdmin

## 🎯 **Endpoints Disponibles**

### **1. Endpoint Público (Sin Autenticación)**
```bash
POST /api/reminders/send-daily
```

**Descripción:** Envía recordatorios diarios a todos los usuarios con oportunidades que necesitan seguimiento.

**Uso:**
```bash
curl -X POST http://localhost:8080/api/reminders/send-daily \
  -H "Content-Type: application/json"
```

**Respuesta:**
```json
{
  "message": "Recordatorios enviados: 1, Errores: 0",
  "sent": 1,
  "errors": []
}
```

---

### **2. Endpoint Seguro (Con Token)**
```bash
POST /api/reminders/send-daily-secure
```

**Descripción:** Mismo funcionamiento que el anterior, pero requiere token de autenticación.

**Uso:**
```bash
curl -X POST http://localhost:8080/api/reminders/send-daily-secure \
  -H "Content-Type: application/json" \
  -d '{"token": "tu-token-aqui"}'
```

**Configuración del Token:**
Agrega a tu archivo `.env`:
```bash
REMINDER_TOKEN=tu-token-secreto-aqui
```

**Respuesta:**
```json
{
  "message": "Recordatorios enviados: 1, Errores: 0",
  "sent": 1,
  "errors": []
}
```

---

## 🔧 **Configuración para Herramientas Externas**

### **Zapier**
1. **Trigger:** Schedule (Daily)
2. **Action:** Webhook POST
3. **URL:** `https://tu-dominio.com/api/reminders/send-daily-secure`
4. **Body:** `{"token": "tu-token-secreto"}`

### **IFTTT**
1. **Trigger:** Date & Time (Daily at 9:00 AM)
2. **Action:** Webhook
3. **URL:** `https://tu-dominio.com/api/reminders/send-daily-secure`
4. **Method:** POST
5. **Body:** `{"token": "tu-token-secreto"}`

### **Cron Job (Linux/Mac)**
```bash
# Agregar a crontab
crontab -e

# Ejecutar todos los días a las 9:00 AM
0 9 * * * curl -X POST https://tu-dominio.com/api/reminders/send-daily-secure -H "Content-Type: application/json" -d '{"token": "tu-token-secreto"}'
```

### **PowerShell (Windows)**
```powershell
# Crear script: send-reminders.ps1
$body = @{
    token = "tu-token-secreto"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://tu-dominio.com/api/reminders/send-daily-secure" -Method POST -Body $body -ContentType "application/json"

# Programar con Task Scheduler
```

---

## 📊 **Lógica de Recordatorios**

### **¿Cuándo se envían recordatorios?**
- **Oportunidades abiertas** (no ganadas ni perdidas)
- **Sin actividad** O **3+ días sin seguimiento**
- **Asignadas a usuarios activos**

### **Contenido del Email:**
- **Asunto:** "¡Atención! Es momento de ponerse en contacto con tus clientes..."
- **Mensaje motivacional:** "¡Atención! Es momento de ponerse en contacto con tus clientes y dar seguimiento a tus oportunidades de negocio."
- **Tabla con:** Oportunidad, Empresa, Estado, Última Actividad

---

## 🛠️ **Monitoreo y Logs**

### **Logs del Servidor:**
```bash
# Ver logs en tiempo real
tail -f logs/app.log

# Buscar logs de recordatorios
grep "🔔 Enviando recordatorios" logs/app.log
```

### **Respuestas de Error:**
```json
{
  "message": "Error enviando recordatorios diarios",
  "error": "Descripción del error"
}
```

---

## 🔒 **Seguridad**

### **Recomendaciones:**
1. **Usa el endpoint seguro** (`/send-daily-secure`) en producción
2. **Configura un token fuerte** en `REMINDER_TOKEN`
3. **Limita el acceso** por IP si es posible
4. **Monitorea los logs** para detectar uso indebido

### **Variables de Entorno Requeridas:**
```bash
SUPABASE_DATABASE_URL=postgresql://...
BREVO_API_KEY=xkeysib-...
FROM_EMAIL=noreply@sheilim.com
FROM_NAME=ShimliAdmin
BASE_URL=https://tu-dominio.com
REMINDER_TOKEN=tu-token-secreto
```

---

## 📱 **Ejemplos de Uso**

### **Python:**
```python
import requests

url = "https://tu-dominio.com/api/reminders/send-daily-secure"
data = {"token": "tu-token-secreto"}

response = requests.post(url, json=data)
print(response.json())
```

### **JavaScript/Node.js:**
```javascript
const axios = require('axios');

const sendReminders = async () => {
  try {
    const response = await axios.post(
      'https://tu-dominio.com/api/reminders/send-daily-secure',
      { token: 'tu-token-secreto' }
    );
    console.log(response.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
};

sendReminders();
```

### **PHP:**
```php
<?php
$url = 'https://tu-dominio.com/api/reminders/send-daily-secure';
$data = ['token' => 'tu-token-secreto'];

$options = [
    'http' => [
        'header' => "Content-type: application/json\r\n",
        'method' => 'POST',
        'content' => json_encode($data)
    ]
];

$context = stream_context_create($options);
$result = file_get_contents($url, false, $context);
echo $result;
?>
```

---

## ✅ **Testing**

### **Probar Localmente:**
```bash
# Endpoint público
curl -X POST http://localhost:8080/api/reminders/send-daily

# Endpoint seguro
curl -X POST http://localhost:8080/api/reminders/send-daily-secure \
  -H "Content-Type: application/json" \
  -d '{"token": "default-reminder-token"}'
```

### **Verificar en Producción:**
```bash
# Reemplazar localhost:8080 con tu dominio
curl -X POST https://tu-dominio.com/api/reminders/send-daily-secure \
  -H "Content-Type: application/json" \
  -d '{"token": "tu-token-secreto"}'
```

---

## 🎯 **Resumen**

- **Endpoint público:** `/api/reminders/send-daily` (sin autenticación)
- **Endpoint seguro:** `/api/reminders/send-daily-secure` (con token)
- **Frecuencia recomendada:** Diaria a las 9:00 AM
- **Lógica:** Oportunidades sin actividad o 3+ días sin seguimiento
- **Respuesta:** JSON con cantidad de emails enviados y errores

¡Listo para usar! 🚀
