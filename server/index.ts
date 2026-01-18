import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { PrismaClient } from '@prisma/client'
import syndicateRoutes from './routes/syndicates.js'
import memberRoutes from './routes/members.js'
import beaterRoutes from './routes/beaters.js'
import shootRoutes from './routes/shoots.js'
import bagRoutes from './routes/bags.js'

const app = express()
const prisma = new PrismaClient()
const PORT = process.env.PORT || 3001

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}))
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
