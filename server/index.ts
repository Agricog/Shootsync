import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'
import syndicateRoutes from './routes/syndicates.js'
import memberRoutes from './routes/members.js'
import beaterRoutes from './routes/beaters.js'
import shootRoutes from './routes/shoots.js'
import bagRoutes from './routes/bags.js'
import guestRoutes from './routes/guests.js'
import stripeRoutes from './routes/stripe.js'
import subscriptionRoutes from './routes/subscriptions.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const prisma = new PrismaClient()
const PORT = process.env.PORT || 3001

// Middleware
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}))

// Stripe webhooks need raw body - must be before express.json()
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }))
app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json' }))

// JSON parsing for all other routes
app.use(express.json())

// Make prisma available to routes
app.locals.prisma = prisma

// Health check
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API Routes
app.use('/api/syndicates', syndicateRoutes)
app.use('/api/members', memberRoutes)
app.use('/api/beaters', beaterRoutes)
app.use('/api/shoots', shootRoutes)
app.use('/api/bags', bagRoutes)
app.use('/api/guests', guestRoutes)
app.use('/api/stripe', stripeRoutes)
app.use('/api/subscriptions', subscriptionRoutes)

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..')))
  
  app.get('*', (_, res) => {
    res.sendFile(path.join(__dirname, '../index.html'))
  })
}

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect()
  process.exit(0)
})
