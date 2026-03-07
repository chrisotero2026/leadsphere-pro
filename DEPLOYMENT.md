# LeadSphere Pro - Deployment Guide

## Overview

LeadSphere Pro is an AI-powered Real Estate CRM platform with:
- **Backend:** Node.js + Express + Prisma
- **Frontend:** Next.js 14 + React 19
- **Database:** PostgreSQL (Manus provides automatically)
- **Cache:** Redis (optional, for performance)

## Deployment Options

### Option 1: Manus (Recommended)
**Pros:**
- ✅ One-click deployment
- ✅ PostgreSQL included
- ✅ SSL/TLS automatic
- ✅ Custom domain support
- ✅ Automatic backups
- ✅ No additional configuration

**Steps:**
1. Click "Publish" in Manus UI
2. Choose your domain
3. Done! Your app is live

### Option 2: Docker (Self-hosted)
**Requirements:**
- Docker & Docker Compose
- PostgreSQL 16+
- Node.js 22+

**Steps:**
```bash
# Build and run
docker-compose -f docker-compose.prod.yml up -d

# Run migrations
docker-compose -f docker-compose.prod.yml exec app npm --prefix backend run db:push

# Check logs
docker-compose -f docker-compose.prod.yml logs -f app
```

### Option 3: Railway
**Requirements:**
- Railway account
- GitHub repository

**Steps:**
1. Push to GitHub
2. Connect repository to Railway
3. Add PostgreSQL plugin
4. Set environment variables
5. Deploy

### Option 4: Vercel (Frontend) + Railway (Backend)
**Frontend (Vercel):**
```bash
vercel deploy --prod
```

**Backend (Railway):**
1. Create Railway project
2. Add PostgreSQL
3. Deploy backend service

## Environment Variables

### Required (Manus provides)
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Session signing key
- `NODE_ENV` - Environment (production/development)

### Optional (Add later)
- `OPENAI_API_KEY` - For AI lead scoring
- `TWILIO_ACCOUNT_SID` - For SMS/calls
- `TWILIO_AUTH_TOKEN` - Twilio authentication
- `TWILIO_PHONE_NUMBER` - Twilio phone number
- `ELEVENLABS_API_KEY` - For voice AI
- `STRIPE_SECRET_KEY` - For payments
- `STRIPE_PUBLISHABLE_KEY` - Stripe public key
- `RESEND_API_KEY` - For email sending

## Database Setup

### Initial Migration
```bash
npm --prefix backend run db:push
```

### Create Admin User
```bash
npm --prefix backend run db:seed
```

## Monitoring & Logs

### View Logs
```bash
# Manus
tail -f .manus-logs/devserver.log

# Docker
docker-compose -f docker-compose.prod.yml logs -f app
```

### Health Check
```bash
curl https://your-domain.com/api/health
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Current user

### Leads
- `GET /api/leads` - List leads
- `POST /api/leads` - Create lead
- `GET /api/leads/:id` - Get lead details
- `PUT /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Delete lead

### Territories
- `GET /api/territories` - List territories
- `POST /api/territories` - Create territory

### AI Scoring
- `POST /api/ai/score` - Score leads with AI

### Billing
- `GET /api/billing/plans` - Get pricing plans
- `GET /api/billing/subscription` - Get current subscription

### SEO
- `POST /api/seo/generate` - Generate SEO page

## Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution:** Ensure PostgreSQL is running and DATABASE_URL is correct

### Port Already in Use
```
Error: listen EADDRINUSE :::3000
```
**Solution:** Kill process or use different port
```bash
lsof -i :3000
kill -9 <PID>
```

### Build Failures
```bash
# Clear cache and rebuild
rm -rf backend/dist frontend/.next
npm --prefix backend run build
npm --prefix frontend run build
```

## Performance Optimization

### Frontend
- ✅ Next.js static generation
- ✅ Image optimization
- ✅ Code splitting
- ✅ CSS optimization

### Backend
- ✅ Connection pooling (Prisma)
- ✅ Redis caching
- ✅ Query optimization
- ✅ Compression middleware

## Security Checklist

- [ ] Change JWT_SECRET in production
- [ ] Enable HTTPS/SSL
- [ ] Set secure CORS headers
- [ ] Validate all inputs
- [ ] Use environment variables for secrets
- [ ] Enable database backups
- [ ] Monitor API usage
- [ ] Set rate limiting

## Scaling

### Horizontal Scaling
1. Deploy multiple instances
2. Use load balancer (Nginx, HAProxy)
3. Share PostgreSQL database
4. Use Redis for session storage

### Vertical Scaling
1. Increase server resources
2. Optimize database queries
3. Enable caching
4. Use CDN for static assets

## Support

For issues or questions:
1. Check logs: `.manus-logs/devserver.log`
2. Review error messages
3. Test API endpoints with curl
4. Check database connectivity

## Next Steps

1. **Add API Keys:** Configure OpenAI, Twilio, Stripe, etc.
2. **Customize Domain:** Set up custom domain
3. **Configure Email:** Set up Resend for transactional emails
4. **Enable Monitoring:** Set up error tracking and analytics
5. **Implement Features:** Add specific business logic

---

**Deployed by Manus** | Last updated: 2026-03-07
