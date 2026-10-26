# Gateway institucional de credenciales verificables — UNAC

Servicio que **custodia la llave de firma, firma y ancla** las credenciales del
portal de Admisiones, y responde las **consultas públicas de verificación**.

Es la pieza que el navegador no puede hacer: si la llave de firma viajara al
cliente, cualquiera que abriera las herramientas de desarrollo podría firmar
un diploma.

> **Sin dependencias externas.** Solo módulos nativos de Node (≥ 20). No hace
> falta `npm install` para correrlo.

---

## Puesta en marcha

```bash
cd gateway

# 1. Configuración
cp .env.example .env

# 2. Llaves de firma (la privada NO se sube al repositorio)
npm run keys

# 3. Arrancar
npm run dev          # http://localhost:3080
```

Comprueba que está vivo:

```bash
curl http://localhost:3080/health
```

---

## Qué hace

| Ruta | Método | Acceso | Función |
|------|--------|--------|---------|
| `/health` | GET | Público | Estado del gateway y de la integridad de la cadena |
| `/api/v1/public-key` | GET | Público | Clave pública de firma (para validar externamente) |
| `/api/v1/anchors` | POST | Staff | Firma el hash y lo ancla |
| `/api/v1/anchors` | GET | Público | Lista los anclajes (solo datos públicos) |
| `/api/v1/verify/:code` | GET | Público | Reporte de verificación en JSON |
| `/api/v1/verify-document` | POST | Público | Verifica un documento presentado contra su anclaje |
| `/api/v1/credentials/:code.html` | GET | Público | Documento imprimible (guardar como PDF) |
| `/verify/:code` | GET | Público | Página de verificación legible por una persona |
| `/api/v1/revocations` | POST | Staff | Revoca un anclaje (escribe, no borra) |

Las rutas de escritura exigen la cabecera `X-Gateway-Token`.

---

## Cómo protege los datos personales

**A la cadena solo llega el hash.** El contenido real del documento (el acta
con las notas, el certificado) se guarda en `data/anchors.documents.json`, que
está **fuera de la cadena** y cifrado en reposo si defines `DOCUMENT_KEY`.

```
Portal  ──payload + hash──▶  Gateway  ──hash + firma──▶  Cadena
   │                            │                            │
   └──── payload se queda ──────┘                            └── solo el hash
```

Puedes comprobarlo en cualquier momento:

```bash
cat data/anchors.jsonl | grep -i "materia\|nota\|nombre"   # no debe encontrar nada
```

---

## La cadena de integridad

En modo `file`, cada anclaje incluye el hash del anclaje anterior
(`previousHash`) y el suyo (`anchorHash`). Alterar una línea antigua rompe el
encadenamiento y el gateway lo detecta:

```bash
curl http://localhost:3080/health | grep cadenaIntacta
```

---

## Conectar el portal

En `src/services/anchoring.service.ts` (SPA):

```ts
const USE_GATEWAY = true;
const GATEWAY_URL = "http://localhost:3080";
```

Y el token, en el `.env` del portal (Vite solo expone las variables `VITE_*`):

```
VITE_GATEWAY_TOKEN=cambia-este-token
```

---

## Modo `network`

Para escribir en una red permissionada real, pon:

```env
RELAY=network
RELAY_URL=http://localhost:7051
```

`src/chain.js` ya tiene el `networkRelay` que delega por HTTP. La
implementación concreta depende de la red elegida (el gateway REST de
Hyperledger Fabric, un contrato en Polygon Edge…), pero **el hashing, la firma
y la verificación son los mismos**: por eso el portal no cambia.

---

## Avisos de seguridad

1. **La llave privada nunca sale del gateway.** No la subas al repositorio.
2. **`STAFF_TOKEN` es un compromiso de clase.** Viaja en el bundle del
   navegador. En producción, OAuth 2.0 con PKCE contra el IdP institucional.
3. **Nunca escribas datos personales en el payload que se ancla.** El hash es
   la prueba de integridad; el payload es información sensible que vive
   fuera de la cadena.
4. **La revocación no borra.** Escribe un anclaje nuevo que apunta al
   anterior: queda constancia de que hubo una revocación, que es lo que
   exige una gestión de revocabilidad auditable.
