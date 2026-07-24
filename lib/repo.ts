import type { MongoClient } from 'mongodb'

import type { InitRepo, RepoTox } from './types'

export function initRepo<T extends Record<string, RepoTox>>(
  mongoClient: MongoClient,
  dbName: string,
  modelToxByCollectionName: T
): InitRepo<T> {
  const result = {} as any
  const db = mongoClient.db(dbName)

  for (const collectionName in modelToxByCollectionName) {
    result[collectionName] = {
      collection: db.collection(collectionName),
      schema: modelToxByCollectionName[collectionName],
    }
  }

  return result
}
