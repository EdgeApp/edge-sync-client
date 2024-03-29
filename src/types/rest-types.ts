/**
 * @file The types in this file describe the sync-server's REST protocol.
 *
 * The type names use the following suffixes:
 * - Body: The JSON request body sent with the request.
 * - Params: The query params passed in the URI.
 * - Response: The JSON response body the endpoint returns.
 */

import {
  asEither,
  asNull,
  asObject,
  asOptional,
  asString,
  asUndefined,
  asValue
} from 'cleaners'

import { asEdgeBox, asNonEmptyString, asSyncKey } from './base-types'

type OmitPartially<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type ServerErrorResponse = ReturnType<typeof asServerErrorResponse>
export const asServerErrorResponse = asObject({
  success: asValue(false),
  message: asString,
  stack: asOptional(asString)
})

export type FileChange = ReturnType<typeof asFileChange>
export const asFileChange = asEither(asEdgeBox, asNull)

export type ChangeSet = ReturnType<typeof asChangeSet>
export const asChangeSet = asObject(asFileChange)

// GET /v2/store
export type GetStoreParams = ReturnType<typeof asGetStoreParams>
export const asGetStoreParams = asObject({
  syncKey: asSyncKey,
  hash: asOptional(asNonEmptyString)
})
export type GetStoreResponse = OmitPartially<
  ReturnType<typeof asGetStoreResponse>,
  'hash'
>
export const asGetStoreResponse = asObject({
  hash: asOptional(asString),
  changes: asChangeSet
})

// POST /v2/store
export type PostStoreParams = ReturnType<typeof asPostStoreParams>
export const asPostStoreParams = asObject({
  syncKey: asSyncKey,
  hash: asOptional(asNonEmptyString)
})
export type PostStoreBody = ReturnType<typeof asPostStoreBody>
export const asPostStoreBody = asObject({
  changes: asChangeSet
})
export type PostStoreResponse = ReturnType<typeof asPostStoreResponse>
export const asPostStoreResponse = asObject({
  hash: asString,
  changes: asChangeSet
})

// PUT /v2/store
export type PutStoreParams = ReturnType<typeof asPutStoreParams>
export const asPutStoreParams = asObject({
  syncKey: asSyncKey
})
export type PutStoreResponse = ReturnType<typeof asPutStoreResponse>
export const asPutStoreResponse = asUndefined
