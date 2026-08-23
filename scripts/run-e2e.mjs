import { spawnSync } from 'node:child_process'

const convex = './node_modules/.bin/convex'
const playwright = './node_modules/.bin/playwright'

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'inherit',
    ...options,
  })
  if (result.error) throw result.error
  return result.status ?? 1
}

const previous = spawnSync(convex, ['env', 'get', 'E2E_TEST_MODE'], {
  cwd: process.cwd(),
  encoding: 'utf8',
})
const previousValue = previous.status === 0 ? previous.stdout.trim() : null

let status = 1
let restoreFailed = false
try {
  if (run(convex, ['env', 'set', 'E2E_TEST_MODE', 'true']) !== 0) {
    throw new Error('Unable to enable Convex E2E test mode')
  }
  status = run(playwright, ['test', ...process.argv.slice(2)])
} finally {
  const restoreStatus = previousValue
    ? run(convex, ['env', 'set', 'E2E_TEST_MODE', previousValue])
    : run(convex, ['env', 'remove', 'E2E_TEST_MODE'])
  restoreFailed = restoreStatus !== 0
}

if (restoreFailed) {
  throw new Error('Unable to restore the Convex E2E test mode setting')
}
process.exitCode = status
