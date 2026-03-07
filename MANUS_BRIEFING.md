# LeadSphere Pro — Briefing para Manus
## Instrucciones completas de deployment y configuración

---

## ¿Qué es este proyecto?

LeadSphere Pro es un CRM SaaS full-stack para bienes raíces (mercado VA/MD/DC).
Stack: **Next.js 14** (frontend) · **Node.js + Express** (backend) · **PostgreSQL** · **Redis** · **Prisma ORM**

Integraciones: OpenAI · Twilio · ElevenLabs · Stripe · Resend

---

## Estructura del proyecto

```
leadsphere-pro/
├── backend/                  ← API Node.js (puerto 3001)
│   ├── .env.example          ← Copiar como .env y llenar
│   ├── package.json
│   ├── prisma/
│   │   └── schema.prisma     ← Schema unificado de BD
│   └── src/
│       ├── index.ts          ← Entrada principal
│       ├── config/
│       │   ├── prisma.ts     ← Cliente de base de datos
│       │   └── services.ts   ← TODAS las integraciones externas
│       ├── controllers/      ← Lógica de negocio
│       ├── routes/           ← Endpoints API
│       ├── middleware/       ← Auth, errores, planes
│       ├── services/         ← Servicios (AI, billing, SEO)
│       ├── workers/          ← Jobs en background
│       ├── queues/           ← Cola de tareas AI
│       ├── webhooks/         ← Stripe webhook
│       └── utils/            ← Helpers y seed
│
├── frontend/                 ← Next.js 14 (puerto 3000)
│   ├── .env.example          ← Copiar como .env.local y llenar
│   ├── package.json
│   └── src/
│       ├── app/
│       │   ├── dashboard/    ← CRM principal (protegido)
│       │   │   ├── page.tsx           Dashboard principal
│       │   │   ├── leads/             Gestión de leads
│       │   │   ├── activities/        Feed de actividades
│       │   │   ├── ai/                Módulo AI Intelligence
│       │   │   ├── billing/           Pagos y suscripciones
│       │   │   ├── territories/       Territorios por ZIP
│       │   │   ├── seo/               Generador de páginas SEO
│       │   │   └── users/             Gestión de equipo
│       │   ├── login/                 Pantalla de login
│       │   ├── plans/                 Página de precios
│       │   └── marketplace/          Marketplace de territorios
│       ├── components/       ← UI components por módulo
│       ├── lib/              ← API clients
│       ├── hooks/            ← Custom hooks
│       └── types/            ← TypeScript types
│
└── docker-compose.yml        ← PostgreSQL + Redis locales
```

---

## PASO 1 — Preparar el entorno local

### Requisitos
- Node.js 18+ → https://nodejs.org
- Docker Desktop → https://www.docker.com/products/docker-desktop
- Git

### Comandos

```bash
# 1. Levantar base de datos y Redis
docker compose up -d

# 2. Esperar 5 segundos, luego verificar
docker ps
# Deben aparecer: leadsphere_db y leadsphere_redis

# 3. Configurar backend
cd backend
cp .env.example .env
# EDITAR .env con las claves API (ver Paso 2)

# 4. Instalar dependencias del backend
npm install

# 5. Generar cliente Prisma y crear tablas
npx prisma generate
npx prisma migrate dev --name init

# 6. Cargar datos de demo
npx tsx src/utils/seed.ts

# 7. Iniciar backend (terminal 1)
npm run dev
# Debe mostrar: LeadSphere Pro API corriendo en puerto 3001

# 8. Configurar frontend (terminal 2)
cd ../frontend
cp .env.example .env.local
npm install
npm run dev
# Debe mostrar: Next.js corriendo en http://localhost:3000
```

### Verificar que funciona
- Abrir Chrome: http://localhost:3000
- Login: admin@leadsphere.app / Admin123!
- Verificar integraciones: http://localhost:3001/health

---

## PASO 2 — Agregar API Keys al archivo .env

Abrir `backend/.env` y completar:

### OpenAI (Lead Scoring AI)
```
OPENAI_API_KEY="sk-..."
```
- Obtener en: https://platform.openai.com/api-keys
- Costo: ~$0.01 por lead scored
- Si no tienes key, pon: AI_DISABLE=true (usará reglas básicas)

### Twilio (SMS + Llamadas)
```
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="xxxxxxxxxxxxxxxxxx"
TWILIO_PHONE_NUMBER="+12025551234"
```
- Trial gratis en: https://www.twilio.com/try-twilio
- Dar $15 crédito sin necesidad de tarjeta

### ElevenLabs (Voz AI para llamadas)
```
ELEVENLABS_API_KEY="xxxxxxxxxxxxxxxx"
ELEVENLABS_VOICE_ID="21m00Tcm4TlvDq8ikWAM"
```
- Gratis hasta 10,000 chars/mes: https://elevenlabs.io
- El VOICE_ID por defecto usa la voz "Rachel"

### Stripe (Pagos y suscripciones)
```
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```
- Cuenta gratis en: https://dashboard.stripe.com/register
- Usar sk_test_... para pruebas — no cobra dinero real
- Para el webhook secret:
  1. Ir a Stripe Dashboard → Developers → Webhooks
  2. Crear webhook con URL: https://tu-dominio.com/webhooks/stripe
  3. Copiar el signing secret

### Crear productos en Stripe
Ir a https://dashboard.stripe.com/products y crear:
- **BASIC** — $99/mes → copiar Price ID a STRIPE_PRICE_BASIC_MONTHLY
- **PROFESSIONAL** — $299/mes → copiar a STRIPE_PRICE_PROFESSIONAL_MONTHLY
- **ENTERPRISE** — $799/mes → copiar a STRIPE_PRICE_ENTERPRISE_MONTHLY

### Resend (Emails)
```
RESEND_API_KEY="re_xxxxxxxxxx"
FROM_EMAIL="noreply@tudominio.com"
```
- Gratis 3,000 emails/mes: https://resend.com

---

## PASO 3 — Deploy en producción

### Opción A: Railway (recomendado — más fácil)

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Crear proyecto (desde la carpeta raíz)
railway init

# Agregar base de datos PostgreSQL
railway add --plugin postgresql

# Agregar Redis
railway add --plugin redis

# Deploy del backend
cd backend
railway up

# Las variables de entorno se configuran en:
# https://railway.app → tu proyecto → Variables
# Agregar todas las variables del .env
```

### Opción B: Manual en VPS (DigitalOcean, AWS, etc.)

```bash
# En el servidor (Ubuntu 22.04)
# 1. Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Instalar PM2 (mantiene el servidor corriendo)
npm install -g pm2

# 3. Subir el proyecto al servidor
# (via git clone o scp)

# 4. Configurar y arrancar backend
cd leadsphere-pro/backend
cp .env.example .env
nano .env  # llenar todas las variables
npm install
npx prisma migrate deploy
npx tsx src/utils/seed.ts
pm2 start "npm run dev" --name leadsphere-api
pm2 save
pm2 startup

# 5. Frontend en Vercel (gratis)
cd ../frontend
# Subir a GitHub y conectar en vercel.com
# Agregar variable: NEXT_PUBLIC_API_URL=https://tu-api.railway.app
```

### Opción C: Frontend en Vercel + Backend en Railway (ideal)

```bash
# Backend → Railway
railway up --service backend

# Frontend → Vercel
npx vercel --prod
# En Vercel Dashboard → Environment Variables agregar:
# NEXT_PUBLIC_API_URL = https://tu-backend.railway.app
```

---

## PASO 4 — Configurar dominio

### En Vercel (frontend)
1. Ir a tu proyecto en vercel.com
2. Settings → Domains → Add Domain
3. Escribir tu dominio: leadsphere.app
4. Vercel te da los registros DNS a configurar

### En tu registrador de dominio (Namecheap, GoDaddy)
Agregar estos registros DNS:
```
Tipo: CNAME  Nombre: @   Valor: cname.vercel-dns.com
Tipo: CNAME  Nombre: www Valor: cname.vercel-dns.com
```

### HTTPS
Se activa automáticamente en Vercel y Railway. No requiere configuración.

---

## PASO 5 — Configurar email transaccional

Para que los emails lleguen desde @tudominio.com y no vayan a spam:

1. En Resend: https://resend.com/domains → Add Domain
2. Agregar los registros DNS que te indican:
   - SPF record
   - DKIM record
   - DMARC record
3. Verificar (tarda 10 min - 48h)

---

## PASO 6 — Verificar que todo funciona

Revisar el endpoint de salud:
```
GET https://tu-api.railway.app/health
```

Respuesta esperada:
```json
{
  "status": "ok",
  "services": {
    "openai": true,
    "twilio": true,
    "elevenlabs": true,
    "stripe": true,
    "resend": true
  }
}
```

Si algún servicio aparece como `false`, revisar que la variable de entorno está correctamente configurada.

---

## PASO 7 — Pruebas funcionales

### Probar SMS (Twilio)
```bash
curl -X POST https://tu-api.railway.app/api/v1/ai/leads/LEAD_ID/followup \
  -H "Authorization: Bearer TU_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel": "sms"}'
```

### Probar AI Scoring (OpenAI)
```bash
curl -X POST https://tu-api.railway.app/api/v1/ai/leads/LEAD_ID/score \
  -H "Authorization: Bearer TU_JWT_TOKEN"
```

### Probar Stripe
1. Ir a https://tu-dominio.com/plans
2. Seleccionar plan BASIC
3. Usar tarjeta de prueba: `4242 4242 4242 4242` con cualquier fecha futura

---

## Cuentas necesarias (todas tienen tier gratuito)

| Servicio      | URL                                      | Para qué           | Costo arranque |
|---------------|------------------------------------------|--------------------|----------------|
| Railway       | railway.app                              | Servidor backend   | ~$5/mes        |
| Vercel        | vercel.com                               | Frontend           | Gratis         |
| Neon/Supabase | neon.tech                                | PostgreSQL         | Gratis         |
| Upstash       | upstash.com                              | Redis              | Gratis         |
| OpenAI        | platform.openai.com                      | AI Scoring         | $5 mínimo      |
| Twilio        | twilio.com                               | SMS/Llamadas       | $15 gratis     |
| ElevenLabs    | elevenlabs.io                            | Voz AI             | Gratis         |
| Stripe        | dashboard.stripe.com                     | Pagos              | Gratis         |
| Resend        | resend.com                               | Email              | Gratis         |
| Dominio       | namecheap.com                            | Tu URL             | ~$12/año       |

**Total primer mes: ~$25-30**

---

## Credenciales demo (solo para pruebas locales)

| Rol     | Email                     | Password     |
|---------|---------------------------|--------------|
| Admin   | admin@leadsphere.app      | Admin123!    |
| Manager | manager@leadsphere.app    | Manager123!  |
| Agente  | agent@leadsphere.app      | Agent123!    |

---

## Comandos útiles

```bash
# Ver logs del backend
pm2 logs leadsphere-api

# Reiniciar backend
pm2 restart leadsphere-api

# Ver base de datos visualmente
cd backend && npx prisma studio
# Abre en http://localhost:5555

# Reset completo de BD (borra TODO y reseedea)
cd backend && npx prisma migrate reset --force && npx tsx src/utils/seed.ts

# Verificar que Redis funciona
docker exec -it leadsphere_redis redis-cli ping
# Debe responder: PONG
```

---

## En caso de errores comunes

### "Cannot connect to database"
- Verificar que Docker está corriendo: `docker ps`
- Reiniciar DB: `docker compose restart postgres`

### "Prisma migration failed"
```bash
cd backend
npx prisma migrate reset --force
npx tsx src/utils/seed.ts
```

### "Port 3001 already in use"
```bash
lsof -i :3001
kill -9 <PID>
```

### "Module not found"
```bash
cd backend && npm install
cd ../frontend && npm install
```

---

*LeadSphere Pro v1.0 — Generado para deployment por Manus*