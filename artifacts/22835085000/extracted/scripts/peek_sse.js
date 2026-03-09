const http = require('http')

const opts = {
  hostname: '127.0.0.1',
  port: 8080,
  path: '/stream/broker-analysis',
  method: 'GET',
  headers: { Accept: 'text/event-stream' },
  timeout: 5000,
}

const req = http.request(opts, (res) => {
  res.setEncoding('utf8')
  let got = ''
  res.on('data', (c) => {
    got += c
    if (got.length > 0) {
      console.log('SSE sample:\n', got)
      req.destroy()
    }
  })
  res.on('end', () => console.log('END'))
})
req.on('error', (e) => console.error('ERR', e.message))
req.end()
