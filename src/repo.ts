import type { MongoClient } from 'mongodb'
import type { InitRepo, RepoStruct } from './types.ts'

export function initRepo<T extends Record<string, RepoStruct>>(
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
