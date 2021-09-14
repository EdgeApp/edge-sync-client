import { expect } from 'chai'

import { syncKeyToRepoId } from '../../src/util/security'

describe('Unit: syncKeyToRepoId', () => {
  it('will convert', () => {
    const sets = [
      [
        '0000000000000000000000000000000000000000',
        'HcrszSicVdm3yRpoE1YptZUzqRXJaMGMdnhU7faYGfte'
      ],
      [
        '1111111111111111111111111111111111111111',
        'H8UYa6TRZMz5doVeTeGhF4GkWQoA9ac83HRnqQm3ySm8'
      ],
      [
        '2222222222222222222222222222222222222222',
        '53GmjdeDv57v8ubfCYtVX3yjsBbsQMUrYJWAg6cQiVh7'
      ],
      [
        '3333333333333333333333333333333333333333',
        'AQgCfWpEQJyAXRSjXhBM1TSBDrPkLvjAQsMzrxuxDRXs'
      ]
    ]

    sets.forEach(([syncKey, repoId]) => {
      expect(syncKeyToRepoId(syncKey)).to.equal(repoId)
    })
  })
})
