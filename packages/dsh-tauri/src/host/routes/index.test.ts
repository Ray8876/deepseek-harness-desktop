import type { IncomingMessage, Server, ServerResponse } from 'node:http'
/**
 * host/routes/index.test.ts — 路由工具的边界测试。
 *
 * 覆盖：宿主注册收敛（同路径多方法只注册一行）、方法约束与 allow 头、连接信任边界、
 * 变更操作回环限制、prefix 匹配、handler 抛错 → 500 + 宿主日志、disposer 卸载、
 * 重复声明回滚、`defineRoutes(setup)` + `registerRoutes(ctx)` 协议、
 * 子路由经 `event.context.dsh` 拿回 ctx、注册期 deps 经 `event.context.dshDeps` 传递
 * （含「同一份声明两次注册互不串台」）。
 *
 * 走真实 node:http 服务（toNodeHandler 依赖真实 req/res 流），并在测试内复刻宿主
 * webserver 的「exact 优先 → 最长前缀优先」匹配契约；假 req/res 用于指定来源地址的分支
 * （连接拒绝、来源 403）与「已过守卫、进入 h3」的放行分支。
 */
import type { AddressInfo } from 'node:net'
import type { HostRoute, RoutesContext, RoutesSetup } from './index.type'
import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import { defineEventHandler, readBody } from 'h3'
import { afterEach, describe, expect, it } from 'vitest'
import { defineRoutes, dshContextOf, dshRouteDepsOf } from './index'

interface Harness {
  host: RoutesContext
  routes: Map<string, HostRoute>
  errors: string[]
}

const routeKey = (route: { kind: string, path: string }): string => `${route.kind}\u0000${route.path}`

/** 假宿主：注册表模拟宿主 webserver（重复 (kind,path) 抛错，disposer 删除该行）。 */
function createHarness(): Harness {
  const routes = new Map<string, HostRoute>()
  const errors: string[] = []
  return {
    routes,
    errors,
    host: {
      webServer: {
        register(route) {
          const key = routeKey(route)
          if (routes.has(key))
            throw new Error(`webserver: duplicate ${route.kind} route "${route.path}"`)
          routes.set(key, route)
          return () => {
            routes.delete(key)
          }
        },
      },
      logger: { error: message => errors.push(message) },
    },
  }
}

/** 复刻宿主 webserver 的匹配契约：exact 表优先，其次 prefix 最长优先。 */
function matchRoute(routes: Map<string, HostRoute>, pathname: string): HostRoute | undefined {
  const exact = routes.get(`exact\u0000${pathname}`)
  if (exact)
    return exact
  let best: HostRoute | undefined
  for (const route of routes.values()) {
    if (route.kind !== 'prefix')
      continue
    if (pathname === route.path || pathname.startsWith(`${route.path}/`)) {
      if (!best || route.path.length > best.path.length)
        best = route
    }
  }
  return best
}

const servers: Server[] = []

/** 按宿主契约起一个真实 HTTP 服务，返回 base URL。 */
async function listen(routes: Map<string, HostRoute>): Promise<string> {
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
    const route = matchRoute(routes, pathname)
    if (!route) {
      response.writeHead(404)
      response.end()
      return
    }
    Promise.resolve(route.handler(request, response)).catch(() => {
      if (!response.headersSent) {
        response.writeHead(400)
        response.end()
      }
    })
  })
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))))
})

/** 假 req：守卫只读 method / socket.remoteAddress / headers；请求体用真实空 Readable，放行分支能跑完 h3。 */
function fakeRequest(method: string, remoteAddress: string, path = '/api/demo', headers: Record<string, string> = {}): IncomingMessage {
  const request = new Readable({ read() {} })
  request.push(null)
  Object.assign(request, {
    method,
    url: path,
    headers,
    socket: { remoteAddress },
  })
  return request as unknown as IncomingMessage
}

/** 假 res：记录 status / headers / body，并补齐 srvx 写响应所需的 setHeader 与写口。 */
function fakeResponse(): { response: ServerResponse, state: { status: number, headers: Record<string, unknown>, body: string } } {
  const state = { status: 0, headers: {} as Record<string, unknown>, body: '' }
  const applyHeaders = (headers: unknown): void => {
    if (Array.isArray(headers)) {
      for (let index = 0; index < headers.length; index += 2)
        state.headers[String(headers[index]).toLowerCase()] = headers[index + 1]
      return
    }
    if (headers !== null && typeof headers === 'object') {
      for (const [name, value] of Object.entries(headers))
        state.headers[name.toLowerCase()] = value
    }
  }
  const response = {
    headersSent: false,
    writableEnded: false,
    destroyed: false,
    setHeader(name: string, value: unknown) {
      state.headers[name.toLowerCase()] = value
      return response
    },
    writeHead(status: number, arg2?: unknown, arg3?: unknown) {
      state.status = status
      if (typeof arg2 === 'string' || arg3 !== undefined)
        applyHeaders(arg3)
      else
        applyHeaders(arg2)
      response.headersSent = true
      return response
    },
    write(chunk?: unknown) {
      if (chunk !== undefined)
        state.body += String(chunk)
      return true
    },
    end(chunk?: unknown, callback?: () => void) {
      if (typeof chunk === 'function')
        (chunk as () => void)()
      else if (chunk !== undefined)
        state.body += String(chunk)
      response.writableEnded = true
      callback?.()
      return response
    },
    on() { return response },
    once() { return response },
    off() { return response },
    removeListener() { return response },
    destroy() {},
  }
  return { response: response as unknown as ServerResponse, state }
}

function routeOf(harness: Harness, kind: string, path: string): HostRoute {
  const route = harness.routes.get(`${kind}\u0000${path}`)
  if (!route)
    throw new Error(`测试断言失败：宿主未注册 ${kind} ${path}`)
  return route
}

function mountRoutes<Deps = undefined>(ctx: RoutesContext, setup: RoutesSetup, deps?: Deps): () => void {
  const register = defineRoutes<Deps>(setup) as (ctx: RoutesContext, deps?: Deps) => () => void
  return register(ctx, deps)
}

describe('defineRoutes', () => {
  it('同一路径的多个方法收敛为一条宿主注册，并按方法分发', async () => {
    const harness = createHarness()
    const dispose = mountRoutes(harness.host, (disposer) => {
      disposer.get({ kind: 'exact', path: '/api/demo' }, defineEventHandler(event => ({ method: 'get', query: event.url.searchParams.get('x') })))
      disposer.post({ kind: 'exact', path: '/api/demo' }, defineEventHandler(async event => ({ method: 'post', body: await readBody(event) })))
    })

    expect(harness.routes.size).toBe(1)
    const base = await listen(harness.routes)

    const get = await fetch(`${base}/api/demo?x=1`)
    expect(get.status).toBe(200)
    expect(await get.json()).toEqual({ method: 'get', query: '1' })

    const post = await fetch(`${base}/api/demo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hello: 'world' }),
    })
    expect(post.status).toBe(200)
    expect(await post.json()).toEqual({ method: 'post', body: { hello: 'world' } })

    dispose()
  })

  it('未声明的方法返回 405 并带 allow 头，未声明 OPTIONS 时直接 204', async () => {
    const harness = createHarness()
    const dispose = mountRoutes(harness.host, (disposer) => {
      disposer.get({ kind: 'exact', path: '/api/demo' }, defineEventHandler(() => ({ ok: true })))
    })
    const base = await listen(harness.routes)

    const removed = await fetch(`${base}/api/demo`, { method: 'DELETE' })
    expect(removed.status).toBe(405)
    expect(removed.headers.get('allow')).toBe('GET, HEAD, OPTIONS')

    const preflight = await fetch(`${base}/api/demo`, { method: 'OPTIONS' })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('allow')).toBe('GET, HEAD, OPTIONS')

    // 支持 GET 即隐含支持 HEAD，不应被误判 405。
    const head = await fetch(`${base}/api/demo`, { method: 'HEAD' })
    expect(head.status).toBe(200)

    dispose()
  })

  it('显式声明的 OPTIONS 处理器优先于默认 204', async () => {
    const harness = createHarness()
    const dispose = mountRoutes(harness.host, (disposer) => {
      disposer.get({ kind: 'exact', path: '/api/demo' }, defineEventHandler(() => ({ ok: true })))
      disposer.options({ kind: 'exact', path: '/api/demo' }, defineEventHandler(() => ({ custom: true })))
    })
    const base = await listen(harness.routes)

    const response = await fetch(`${base}/api/demo`, { method: 'OPTIONS' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ custom: true })

    dispose()
  })

  it('connection 信任边界先于业务 handler 生效', async () => {
    const harness = createHarness()
    harness.host.connection = { requestRejection: () => 401 }
    const dispose = mountRoutes(harness.host, (disposer) => {
      disposer.get({ kind: 'exact', path: '/api/demo' }, defineEventHandler(() => ({ ok: true })))
    })

    const { response, state } = fakeResponse()
    await routeOf(harness, 'exact', '/api/demo').handler(fakeRequest('GET', '127.0.0.1'), response)
    expect(state.status).toBe(401)
    expect(state.body).toBe(JSON.stringify({ error: 'unauthorized' }))

    dispose()
  })

  it('变更操作拒绝非本机来源，读操作不受回环限制', async () => {
    const harness = createHarness()
    const dispose = mountRoutes(harness.host, (disposer) => {
      disposer.get({ kind: 'exact', path: '/api/read' }, defineEventHandler(() => ({ ok: true })))
      disposer.post({ kind: 'exact', path: '/api/write' }, defineEventHandler(() => ({ ok: true })))
    })

    const write = fakeResponse()
    await routeOf(harness, 'exact', '/api/write').handler(fakeRequest('POST', '10.0.0.5', '/api/write'), write.response)
    expect(write.state.status).toBe(403)
    expect(write.state.body).toContain('仅限本机')

    // 读操作不因来源被回环规则拦下：放行后由 h3 正常应答（no-transform 头只在三条守卫之后才设置）
    const read = fakeResponse()
    const readRoute = routeOf(harness, 'exact', '/api/read')
    await readRoute.handler(fakeRequest('GET', '10.0.0.5', '/api/read'), read.response)
    expect(read.state.status).toBe(200)
    expect(read.state.body).toBe(JSON.stringify({ ok: true }))
    expect(read.state.headers['cache-control']).toBe('no-transform')

    dispose()
  })

  it('变更操作拒绝跨源 Origin（CSRF / DNS rebinding），无 Origin 的非浏览器调用方放行', async () => {
    const harness = createHarness()
    const dispose = mountRoutes(harness.host, (disposer) => {
      disposer.get({ kind: 'exact', path: '/api/read' }, defineEventHandler(() => ({ ok: true })))
      disposer.post({ kind: 'exact', path: '/api/write' }, defineEventHandler(() => ({ ok: true })))
    })

    // Origin 与 Host 不符：拒绝。
    const crossOrigin = fakeResponse()
    await routeOf(harness, 'exact', '/api/write').handler(
      fakeRequest('POST', '127.0.0.1', '/api/write', { origin: 'http://evil.example', host: '127.0.0.1:3080' }),
      crossOrigin.response,
    )
    expect(crossOrigin.state.status).toBe(403)
    expect(crossOrigin.state.body).toContain('cross-origin-request')

    // 同源 Origin：放行（进入 h3 并由 no-transform 头证明已过守卫）
    const sameOrigin = fakeResponse()
    const sameOriginRoute = routeOf(harness, 'exact', '/api/write')
    await sameOriginRoute.handler(
      fakeRequest('POST', '127.0.0.1', '/api/write', { origin: 'http://127.0.0.1:3080', host: '127.0.0.1:3080' }),
      sameOrigin.response,
    )
    expect(sameOrigin.state.status).toBe(200)
    expect(sameOrigin.state.body).toBe(JSON.stringify({ ok: true }))
    expect(sameOrigin.state.headers['cache-control']).toBe('no-transform')

    // 无 Origin：放行（curl / 宿主内部调用）
    const noOrigin = fakeResponse()
    const noOriginRoute = routeOf(harness, 'exact', '/api/write')
    await noOriginRoute.handler(fakeRequest('POST', '127.0.0.1', '/api/write'), noOrigin.response)
    expect(noOrigin.state.status).toBe(200)
    expect(noOrigin.state.body).toBe(JSON.stringify({ ok: true }))
    expect(noOrigin.state.headers['cache-control']).toBe('no-transform')

    dispose()
  })

  it('非回环来源的 PUT / PATCH / DELETE 同样被拒，回环来源放行', async () => {
    const harness = createHarness()
    const dispose = mountRoutes(harness.host, (disposer) => {
      disposer.put({ kind: 'exact', path: '/api/put' }, defineEventHandler(() => ({ ok: true })))
      disposer.patch({ kind: 'exact', path: '/api/patch' }, defineEventHandler(() => ({ ok: true })))
      disposer.delete({ kind: 'exact', path: '/api/delete' }, defineEventHandler(() => ({ ok: true })))
    })

    const mutating = [
      ['PUT', '/api/put'],
      ['PATCH', '/api/patch'],
      ['DELETE', '/api/delete'],
    ] as const
    for (const [method, path] of mutating) {
      const rejected = fakeResponse()
      await routeOf(harness, 'exact', path).handler(fakeRequest(method, '10.0.0.5', path), rejected.response)
      expect(rejected.state.status).toBe(403)
      expect(rejected.state.body).toContain('变更操作仅限本机')
    }

    for (const [method, path] of mutating) {
      const allowed = fakeResponse()
      await routeOf(harness, 'exact', path).handler(fakeRequest(method, '127.0.0.1', path), allowed.response)
      expect(allowed.state.status).toBe(200)
      expect(allowed.state.body).toBe(JSON.stringify({ ok: true }))
    }

    dispose()
  })

  it('超过 1 MiB 的请求体在读体时以 413 结束（h3 bodyLimit）', async () => {
    const harness = createHarness()
    const dispose = mountRoutes(harness.host, (disposer) => {
      disposer.post({ kind: 'exact', path: '/api/big' }, defineEventHandler(async event => ({ body: await readBody(event) })))
    })
    const base = await listen(harness.routes)

    const response = await fetch(`${base}/api/big`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pad: 'x'.repeat(2 * 1024 * 1024) }),
    })
    expect(response.status).toBe(413)

    dispose()
  })

  it('交给 h3 的响应统一带 cache-control: no-transform（压掉宿主 gzip 中间件），守卫分支不带', async () => {
    const harness = createHarness()
    const dispose = mountRoutes(harness.host, (disposer) => {
      disposer.get({ kind: 'exact', path: '/api/demo' }, defineEventHandler(() => ({ ok: true })))
    })
    const base = await listen(harness.routes)

    const response = await fetch(`${base}/api/demo`)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-transform')

    const notAllowed = await fetch(`${base}/api/demo`, { method: 'DELETE' })
    expect(notAllowed.status).toBe(405)
    expect(notAllowed.headers.get('cache-control')).toBeNull()

    dispose()
  })

  it('prefix 声明注册为宿主 prefix 行，并匹配子路径', async () => {
    const harness = createHarness()
    const dispose = mountRoutes(harness.host, (disposer) => {
      disposer.get({ kind: 'prefix', path: '/api/demo' }, defineEventHandler(event => ({ path: event.url.pathname })))
    })

    expect([...harness.routes.keys()]).toEqual(['prefix\u0000/api/demo'])
    const base = await listen(harness.routes)

    const response = await fetch(`${base}/api/demo/items/7`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ path: '/api/demo/items/7' })

    dispose()
  })

  it('handler 抛错时返回 500 并写入宿主日志', async () => {
    const harness = createHarness()
    const dispose = mountRoutes(harness.host, (disposer) => {
      disposer.get({ kind: 'exact', path: '/api/demo' }, defineEventHandler(() => {
        throw new Error('boom')
      }))
    })
    const base = await listen(harness.routes)

    const response = await fetch(`${base}/api/demo`)
    expect(response.status).toBe(500)
    expect(harness.errors.some(message => message.includes('boom'))).toBe(true)

    dispose()
  })

  it('子路由经 event.context.dsh 拿回宿主 ctx', async () => {
    const harness = createHarness()
    const dispose = mountRoutes(harness.host, (disposer) => {
      disposer.get({ kind: 'exact', path: '/api/demo' }, defineEventHandler((event) => {
        const ctx = dshContextOf(event)
        return {
          sameCtx: ctx === harness.host,
          bareReadable: event.context.dsh === harness.host,
          hasWebServer: typeof ctx?.webServer?.register === 'function',
        }
      }))
    })
    const base = await listen(harness.routes)

    const response = await fetch(`${base}/api/demo`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ sameCtx: true, bareReadable: true, hasWebServer: true })

    dispose()
  })

  it('注册期 deps 挂到 event.context.dshDeps，且与传入对象身份相等', async () => {
    const harness = createHarness()
    const deps = { label: 'alpha', root: '/tmp/worktrees' }
    const dispose = mountRoutes(harness.host, (disposer) => {
      disposer.get({ kind: 'exact', path: '/api/demo' }, defineEventHandler((event) => {
        const read = dshRouteDepsOf<typeof deps>(event)
        return {
          sameDeps: read === deps,
          bareReadable: event.context.dshDeps === deps,
          label: read?.label,
        }
      }))
    }, deps)
    const base = await listen(harness.routes)

    const response = await fetch(`${base}/api/demo`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ sameDeps: true, bareReadable: true, label: 'alpha' })

    dispose()
  })

  it('零依赖注册不挂 deps，dshRouteDepsOf 返回 undefined', async () => {
    const harness = createHarness()
    const dispose = mountRoutes(harness.host, (disposer) => {
      disposer.get({ kind: 'exact', path: '/api/demo' }, defineEventHandler(event => ({
        hasDeps: dshRouteDepsOf(event) !== undefined,
      })))
    })
    const base = await listen(harness.routes)

    expect(await (await fetch(`${base}/api/demo`)).json()).toEqual({ hasDeps: false })

    dispose()
  })

  it('同一份声明用两组 deps 各注册一次时各读各的（模块级单例会串台）', async () => {
    // 这正是废弃 bindRouteDeps 的原因：deps 由注册期闭包捕获，两次注册互不影响。
    const declaration = defineRoutes<{ label: string }>((disposer) => {
      disposer.get({ kind: 'exact', path: '/api/demo' }, defineEventHandler(event => ({
        label: dshRouteDepsOf<{ label: string }>(event)?.label,
      })))
    })

    const first = createHarness()
    const second = createHarness()
    const disposeFirst = declaration(first.host, { label: 'first' })
    const disposeSecond = declaration(second.host, { label: 'second' })

    const firstBase = await listen(first.routes)
    const secondBase = await listen(second.routes)

    expect(await (await fetch(`${firstBase}/api/demo`)).json()).toEqual({ label: 'first' })
    expect(await (await fetch(`${secondBase}/api/demo`)).json()).toEqual({ label: 'second' })

    disposeFirst()
    disposeSecond()
  })

  it('disposer 卸载全部宿主注册', () => {
    const harness = createHarness()
    const dispose = mountRoutes(harness.host, (disposer) => {
      disposer.get({ kind: 'exact', path: '/api/a' }, defineEventHandler(() => ({ ok: true })))
      disposer.post({ kind: 'prefix', path: '/api/b' }, defineEventHandler(() => ({ ok: true })))
    })

    expect(harness.routes.size).toBe(2)
    dispose()
    expect(harness.routes.size).toBe(0)
  })

  it('同一路径在两个 effect 中重复声明时抛错，并回滚本次已注册的行', () => {
    const harness = createHarness()
    const firstDispose = mountRoutes(harness.host, (disposer) => {
      disposer.get({ kind: 'exact', path: '/api/a' }, defineEventHandler(() => ({ ok: true })))
    })

    const second = defineRoutes((disposer) => {
      disposer.get({ kind: 'exact', path: '/api/b' }, defineEventHandler(() => ({ ok: true })))
      disposer.get({ kind: 'exact', path: '/api/a' }, defineEventHandler(() => ({ ok: true })))
    })
    expect(() => second(harness.host)).toThrowError(/duplicate/)
    // /api/b 已注册但被回滚，只剩第一个 effect 的 /api/a。
    expect([...harness.routes.keys()]).toEqual(['exact\u0000/api/a'])

    firstDispose()
  })

  it('按协议声明，并在运行期用 registerRoutes(ctx) 注册（配合 ctx.effect 使用）', () => {
    const harness = createHarness()
    const registerRoutes = defineRoutes((disposer) => {
      disposer.get({ kind: 'exact', path: '/api/demo' }, defineEventHandler(() => ({ ok: true })))
    })
    const dispose = registerRoutes(harness.host)

    expect(harness.routes.size).toBe(1)
    dispose()
    expect(harness.routes.size).toBe(0)
  })

  it('registerRoutes 缺少 webServer 时立即抛错', () => {
    const registerRoutes = defineRoutes((disposer) => {
      disposer.get({ kind: 'exact', path: '/api/demo' }, defineEventHandler(() => ({ ok: true })))
    })
    expect(() => registerRoutes(undefined as unknown as RoutesContext)).toThrowError(/webServer/)
  })

  it('声明期拒绝不支持的方法', () => {
    const harness = createHarness()
    expect(() => mountRoutes(harness.host, (disposer) => {
      disposer.on('TRACE' as 'GET', { kind: 'exact', path: '/api/demo' }, defineEventHandler(() => ({ ok: true })))
    })).toThrowError(/不支持的方法/)
  })
})
