import { expect } from 'chai'
import { describe, it } from 'mocha'

import { dummy } from '../src'

describe('dummy', function () {
  it('returns double', function () {
    expect(dummy(4)).equals(8)
  })
})
