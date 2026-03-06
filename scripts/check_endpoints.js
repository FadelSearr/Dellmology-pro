#!/usr/bin/env node
const http = require('http')

const hosts = ['127.0.0.1', 'localhost']
const port = 8080

function checkRest(host) {
  return new Promise((resolve) => {
    const opts = {
      hostname: host,
      port,
      path: '/api/broker/stats?symbol=BBCA',
      method: 'GET',
      timeout: 5000,
    }
    const req = http.request(opts, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (c) => { body += c })
      res.on('end', () => {
        resolve({ host, status: res.statusCode, headers: res.headers, body: body.slice(0, 200) })
      })
    })
    req.on('error', (err) => resolve({ host, err: err.message }))
    req.on('timeout', () => { req.destroy(); resolve({ host, err: 'timeout' }) })
    req.end()
  })
}

function checkSSE(host) {
  return new Promise((resolve) => {
    const opts = {
      hostname: host,
      port,
      path: '/stream/broker-analysis',
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
      timeout: 5000,
    }
    const req = http.request(opts, (res) => {
      const info = { host, status: res.statusCode, headers: res.headers }
      let got = ''
      res.setEncoding('utf8')
      res.on('data', (c) => {
        got += c
        if (got.length > 0) {
          req.destroy()
          resolve(Object.assign(info, { sample: got.slice(0, 400) }))
        }
      })
      res.on('end', () => resolve(Object.assign(info, { sample: got.slice(0, 400) })))
    })
    req.on('error', (err) => resolve({ host, err: err.message }))
    req.on('timeout', () => { req.destroy(); resolve({ host, err: 'timeout' }) })
    req.end()
  })
}

;(async function main(){
  console.log('Checking streamer endpoints on port', port)
  for (const host of hosts) {
    const rest = await checkRest(host)
    console.log('REST', host, rest.err || (`status=${rest.status}`))
    if (!rest.err) console.log('  body-snippet:', rest.body)

    const sse = await checkSSE(host)
    console.log('SSE ', host, sse.err || (`status=${sse.status}`))
    if (!sse.err && sse.sample) console.log('  sample:', sse.sample.replace(/\n/g, '\\n').slice(0,300))
  }
})()
