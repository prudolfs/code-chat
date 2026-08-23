import { httpRouter } from 'convex/server'
import { createClient } from '@convex-dev/better-auth'
import { components } from './_generated/api'
import { createAuth } from './auth'
import type { DataModel } from './_generated/dataModel'

const http = httpRouter()
const authComponent = createClient<DataModel>(components.betterAuth)

authComponent.registerRoutes(http, createAuth)

export default http
