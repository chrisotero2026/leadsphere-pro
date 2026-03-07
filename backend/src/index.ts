import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app: Express = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes (placeholder)
app.get('/api/leads', (req: Request, res: Response) => {
  res.json({ message: 'Leads endpoint', data: [] });
});

app.get('/api/territories', (req: Request, res: Response) => {
  res.json({ message: 'Territories endpoint', data: [] });
});

app.get('/api/ai/score', (req: Request, res: Response) => {
  res.json({ message: 'AI Scoring endpoint', score: 0 });
});

app.get('/api/billing/plans', (req: Request, res: Response) => {
  res.json({ message: 'Billing plans endpoint', plans: [] });
});

// Error handling
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`[LeadSphere Backend] Server running on http://localhost:${PORT}`);
});

export default app;
