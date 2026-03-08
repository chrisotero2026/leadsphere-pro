import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

// Core routes
import { authRouter }       from './routes/auth.routes';
import { usersRouter }      from './routes/users.routes';
import { leadsRouter }      from './routes/leads.routes';
import { activitiesRouter } from './routes/activities.routes';
import { statsRouter }      from './routes/stats.routes';
// Feature routes
import { aiRouter }         from './routes/ai.routes';
import { billingRouter }    from './routes/billing.routes';
// Middleware
import { errorHandler } from './middleware/error.middleware';
import { notFound }     from './middleware/notFound.middleware';

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Security ──────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false }));

// ── Parsing ───────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Health ────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    services: {
      openai:     !!process.env.OPENAI_API_KEY,
      anthropic:  !!process.env.ANTHROPIC_API_KEY,
      twilio:     !!process.env.TWILIO_ACCOUNT_SID,
      elevenlabs: !!process.env.ELEVENLABS_API_KEY,
      stripe:     !!process.env.STRIPE_SECRET_KEY,
      resend:     !!process.env.RESEND_API_KEY,
    },
  });
});

// ── Routes ────────────────────────────────────────────────────
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use('/api/v1/auth',        authLimiter, authRouter);
app.use('/api/v1/users',       usersRouter);
app.use('/api/v1/leads',       leadsRouter);
app.use('/api/v1/activities',  activitiesRouter);
app.use('/api/v1/stats',       statsRouter);
app.use('/api/v1/ai',          aiRouter);
app.use('/api/v1/billing',     billingRouter);

// ── Error handling ────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║         LeadSphere Pro API  v1.0.0               ║
║  🚀  http://localhost:${PORT}                      ║
║  🔍  Health: http://localhost:${PORT}/health       ║
╠══════════════════════════════════════════════════╣
║  OpenAI:      ${process.env.OPENAI_API_KEY      ? '✅ Connected' : '⚠️  Missing'}              ║
║  Twilio:      ${process.env.TWILIO_ACCOUNT_SID  ? '✅ Connected' : '⚠️  Missing'}              ║
║  ElevenLabs:  ${process.env.ELEVENLABS_API_KEY  ? '✅ Connected' : '⚠️  Missing'}              ║
║  Stripe:      ${process.env.STRIPE_SECRET_KEY   ? '✅ Connected' : '⚠️  Missing'}              ║
║  Resend:      ${process.env.RESEND_API_KEY      ? '✅ Connected' : '⚠️  Missing'}              ║
╚══════════════════════════════════════════════════╝
  `);
});

export default app;
