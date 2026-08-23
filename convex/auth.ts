import { betterAuth } from 'better-auth'
import { convexAdapter } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import { createClient } from '@convex-dev/better-auth'
import { components } from './_generated/api'
import authConfig from './auth.config'
import type { CreateAuth, GenericCtx } from '@convex-dev/better-auth'
import type { DataModel } from './_generated/dataModel'

const authComponent = createClient<DataModel>(components.betterAuth)

export const createAuth: CreateAuth<DataModel> = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    database: convexAdapter(ctx as GenericCtx, components.betterAuth),
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      },
      github: {
        clientId: process.env.GITHUB_CLIENT_ID ?? '',
        clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
      },
    },
    plugins: [convex({ authConfig })],
  })

export const { getAuthUser } = authComponent.clientApi()
