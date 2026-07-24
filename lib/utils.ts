import { ERROR } from './constants'

import type { ClientSession } from 'mongodb'
import type { RepoModel, RepoTox, InitRepo } from './types'

export function getSchemaKeys(
  modelToxByCollectionName: Record<string, RepoTox>,
  collectionName: string
) {
  const tox = modelToxByCollectionName[collectionName] as RepoTox

  if (tox.__schema.type === 'object') {
    if (tox.__schema.of.id === undefined) {
      throw new Error(ERROR.noIdField(collectionName))
    }
  } else {
    for (const sub of tox.__schema.of) {
      if (sub.of.id === undefined) {
        throw new Error(ERROR.noIdField(collectionName))
      }
    }
  }

  const schemaUnion =
    tox.__schema.type === 'union' ? tox.__schema.of : [tox.__schema]

  const schemaKeys = new Set<string>()

  for (const { of: schemaOf } of schemaUnion) {
    for (const sourceFieldKey in schemaOf) {
      if (sourceFieldKey === 'id') {
        continue
      }

      schemaKeys.add(sourceFieldKey)
    }
  }

  return { tox, schemaKeys }
}

/**
 * Stub each repo model method with predefined `session` and `userId`
 **/
export function getModifiedRepo<T extends InitRepo<Record<string, RepoTox>>>(
  repo: T,
  session?: ClientSession,
  userId?: string
): T {
  const result = {} as T

  for (const key in repo) {
    const model = repo[key as keyof typeof repo] as RepoModel
    const updatedModel: Record<keyof typeof model, unknown> = {
      tox: model.tox,

      mongo: (_session?: ClientSession, _userId?: string) =>
        model.mongo(_session || session, _userId || userId),

      get: (filter: never, _session?: ClientSession) =>
        model.get(filter, _session || session),

      post: (value: never, _session?: ClientSession, _userId?: string) =>
        model.post(value, _session || session, _userId || userId),

      put: (value: never, _session?: ClientSession, _userId?: string) =>
        model.put(value, _session || session, _userId || userId),

      remove: (value: never, _session?: ClientSession, _userId?: string) =>
        model.remove(value, _session || session, _userId || userId),
    }

    // @ts-expect-error can't proof `key` <-> `updatedModel` relation
    result[key] = updatedModel
  }

  return result
}

export function sanitizeMongoRecord(x: Record<string, unknown>) {
  delete x._id
  delete x.__v

  for (const key in x) {
    if (x[key] === null) {
      delete x[key]
    }
  }
}
