# Automatizaciones n8n — Admisiones UNAC

Workflows de n8n que se conectan al portal de admisiones.

## Workflows disponibles

| Archivo | Qué hace |
|---|---|
| `workflows/admisiones-nuevo-aspirante.json` | Recibe un POST cuando un Aspirante envía su solicitud en el portal y notifica al Staff por Telegram |

## Cómo importar un workflow en n8n

1. En n8n, abre o crea un workflow vacío.
2. Click en el **⋮ (tres puntos)** arriba a la derecha del canvas.
3. Click **"Import from File..."** y selecciona `workflows/<nombre>.json`.
4. Aparece el flujo con los 3 nodos: **Webhook → Telegram → Respond**.
5. Crea la credencial de Telegram (ver abajo).
6. Reemplaza `REEMPLAZAR_CON_TU_CHAT_ID` en el nodo Telegram por el `chat.id` real.

## Cómo obtener la credencial de Telegram

### 1. Crear el bot

1. En Telegram, habla con **@BotFather**.
2. Envía `/newbot` → responde con un nombre (ej: `UNAC Admisiones Bot`) → responde con un username único (ej: `unac_admisiones_bot`).
3. BotFather responde con un **TOKEN** tipo `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`. Guárdalo.

### 2. Obtener el chat_id del grupo

1. Crea un grupo nuevo en Telegram (ej: "Admisiones UNAC Staff").
2. Añade tu bot al grupo como miembro.
3. Envía cualquier mensaje al grupo (ej: `hola`).
4. En el navegador visita:
   ```
   https://api.telegram.org/bot<TU_TOKEN>/getUpdates
   ```
5. En el JSON resultante busca:
   ```json
   "chat": { "id": -123456789, "title": "Admisiones UNAC Staff", ... }
   ```
   Ese número **negativo** es el `chat_id` que pegas en n8n.

### 3. Crear credencial en n8n

1. Click en el **nodo Telegram**.
2. En el campo **Credential to connect with** click **"Create New"**.
3. Pega el **Token** del paso 1.
4. Click **Save**.
5. Vuelve al nodo, click en **Chat ID** y pega el número negativo del paso 2.

## Probar el workflow

1. Click el toggle **"Active"** arriba a la derecha (se vuelve verde).
2. Click en el nodo **Webhook** y copia la URL tipo:
   ```
   https://<tu-n8n>.app.n8n.cloud/webhook/nuevo-aspirante
   ```
3. Desde otra terminal:
   ```bash
   curl -X POST https://<tu-n8n>.app.n8n.cloud/webhook/nuevo-aspirante \
     -H "Content-Type: application/json" \
     -d '{"nombre":"Juan Pérez","programa":"Ingeniería de Sistemas","email":"juan@test.com","telefono":"+57 300 1234567"}'
   ```
4. Deberías recibir:
   - Mensaje en el grupo de Telegram.
   - Respuesta JSON `{"status":"ok","notificado":true}` en la terminal.

## Próximos pasos

- [ ] Agregar nodo **Google Sheets** al flujo para tener bitácora compartida con el Staff.
- [ ] Conectar el SPA (`src/`) a este webhook para que envíe la solicitud real.
