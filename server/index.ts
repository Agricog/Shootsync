/**
 * Server entry point - ShootSync
 * Validates configuration, then starts the app. Refuses to start with any secret missing.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import Stripe from 'stripe'
import { ConfigError, loadConfig } from './config.js'
import { createClerkVerifier } from './auth.js'
import { createApp } from './app.js'

let config
try {
  config = loadConfig()
} catch (err) {
  if (err instanceof ConfigError) {
    console.error(`[boot] ${err.message}. Add them in Railway → Variables, then redeploy.`)
    process.exit(1)
  }
  throw err
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const prisma = new PrismaClient()
const stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2023-10-16' })

const app = createApp({
  prisma,
  stripe,
  config,
  verifyToken: createClerkVerifier(config.clerkSecretKey, config.allowedOrigins),
  // dist/server/index.js → dist/ holds the built frontend
  staticDir: config.isProduction ? path.join(__dirname, '..') : undefined,
})

const PORT = Number(process.env.PORT) || 3001

const server = app.listen(PORT, () => {
  // Boot log is a verification point (Standard §19.10): it names what this process will accept.
  console.log(`[boot] ShootSync API listening on ${PORT}`)
  console.log(`[boot] Sessions accepted from: ${config.allowedOrigins.join(', ')}`)
  console.log(`[boot] Stripe mode: ${config.stripeSecretKey.startsWith('sk_live_') ? 'LIVE' : 'TEST'}`)
})

async function shutdown(signal: string) {
  console.log(`[shutdown] ${signal} received`)
  server.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
