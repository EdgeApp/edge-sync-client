import { expect } from 'chai'
import { describe, it } from 'mocha'

import { anyPromise } from '../../src/anyPromise'

describe('promiseAny', function () {
  it('accepts the first resolved promise', async function () {
    const out = await anyPromise([
      Promise.reject(new Error()),
      Promise.resolve(2)
    ])
    expect(out).equals(2)
  })

  it('rejects if everyone rejects', async function () {
    await anyPromise([
      Promise.reject(new Error()),
      Promise.reject(new Error())
    ]).then(
      ok => {
        throw new Error('This should have errored')
      },
      error => {}
    )
  })
})
