/// <reference types="@cloudflare/workers-types" />
// Cloudflare Pages Functions: toda chamada /api/* cai aqui.
import { handleApi, type Env } from '../../server/api'

export const onRequest: PagesFunction<Env> = (ctx) => handleApi(ctx.request, ctx.env)
