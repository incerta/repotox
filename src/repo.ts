import type { MongoClient } from 'mongodb'
import type { InitRepo, RepoTox } from './types.ts'

export function initRepo<T extends Record<string, RepoTox>>(
  mongoClient: MongoClient,
  dbName: string,
  modelSchemaByCollectionName: T
): InitRepo<T> {
  const result = {} as InitRepo<T>
  const db = mongoClient.db(dbName)

  for (const collectionName in modelSchemaByCollectionName) {
    result[collectionName] = {
      collection: db.collection(collectionName),
      schema: modelSchemaByCollectionName[collectionName],
    }
  }

  return result
}
