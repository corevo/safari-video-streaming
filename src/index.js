const fs = require('fs')
const path = require('path')
const {promisify: p} = require('util')
const fastify = require('fastify')
const memoize = require('memoizee')

const app = fastify({
  logger: true,
})

const videoFilePath = path.resolve(__dirname, './video.webm')

app.head('/video.webm', async (_, res) => {
  const contentLength = await getVideoFileContentLength()
  res.statusCode = 200
  res.header('accept-ranges', 'bytes')
  res.header('content-length', contentLength)
  res.end()
})

app.get('/video.webm', async (req, res) => {
  const {start, end} = parseRangeHeader(req.headers.range)

  res.header('content-type', 'video/webm')
  const contentLength = await getVideoFileContentLength()

  let retrievedLength
  if (start !== undefined && end !== undefined) {
    retrievedLength = end + 1 - start
  } else if (start !== undefined) {
    retrievedLength = contentLength - start
  } else if (end !== undefined) {
    retrievedLength = end + 1
  } else {
    retrievedLength = contentLength
  }

  res.statusCode = start !== undefined || end !== undefined ? 206 : 200

  res.header('content-length', retrievedLength)

  if (req.headers.range !== undefined) {
    res.header('content-range', `bytes ${start || 0}-${end || contentLength - 1}/${contentLength}`)
    res.header('accept-ranges', 'bytes')
  }

  const fileStream = fs.createReadStream(videoFilePath, {start, end})
  res.send(fileStream)
})

app.register(require('fastify-static'), {
  root: path.join(__dirname, '../public'),
})

const getVideoFileContentLength = memoize(
  async () => {
    const stats = await p(fs.stat)(videoFilePath)

    return stats.size
  },
  {promise: true},
)

function parseRangeHeader(range) {
  if (!range) return {}

  let start, end

  const bytesPrefix = 'bytes='
  if (range.startsWith(bytesPrefix)) {
    const bytesRange = range.substring(bytesPrefix.length)
    const parts = bytesRange.split('-')
    if (parts.length === 2) {
      const rangeStart = parts[0] && parts[0].trim()
      if (rangeStart && rangeStart.length > 0) {
        start = parseInt(rangeStart)
      }
      const rangeEnd = parts[1] && parts[1].trim()
      if (rangeEnd && rangeEnd.length > 0) {
        end = parseInt(rangeEnd)
      }
    }
  }

  return {
    start,
    end,
  }
}

const start = async () => {
  try {
    await app.listen(3000)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}
start()
