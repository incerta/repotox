import { ERROR, USED_UUID_SYSTEM_COLLECTION } from './constants'
import { getSchemaKeys, sanitizeMongoRecord, getModifiedRepo } from './utils'

import type { ClientSession, MongoClient } from 'mongodb'

import type { CommonDoc, InitRepo, RepoTox } from './types'

export function initRepo<T extends Record<string, RepoTox>>(
  mongoClient: MongoClient,
  dbName: string,
  models: T
): Promise<InitRepo<T>>

export async function initRepo<T extends Record<string, RepoTox>>(
  mongoClient: MongoClient,
  dbName: string,
  modelToxByCollectionName: T
): Promise<Record<string, unknown>> {
  const result = {} as any
  const db = mongoClient.db(dbName)

  const __uuid = db.collection<{ id: string }>(USED_UUID_SYSTEM_COLLECTION)

  for (const collectionName in modelToxByCollectionName) {
    const { tox, schemaKeys } = getSchemaKeys(
      modelToxByCollectionName,
      collectionName
    )

    const collection = db.collection(collectionName)

    const get = async (
      filter: Record<string, unknown> = {},
      session: ClientSession | undefined
    ): Promise<Array<Record<string, string>>> => {
      const res = await collection.find(filter, { session }).toArray()

      if (res === undefined) {
        return []
      }

      for (const x of res) {
        sanitizeMongoRecord(x)
      }

      return res
    }

    const post = async (
      input: CommonDoc,
      session: ClientSession | undefined,
      userId: string | undefined
    ) => {
      const timestamp = Date.now()

      input.createdAt = timestamp
      input.updatedAt = timestamp

      if (userId) {
        input.createdBy = userId
        input.updatedBy = userId
      }

      const either = tox.parse(input)

      if (either.success === false) {
        throw either.error
      }

      const uuid = await __uuid.findOne({ id: input.id })

      if (uuid !== null) {
        throw Error(ERROR.idIsAlreadyTaken(uuid.id))
      }

      const [record] = await get({ id: input.id }, session)

      if (record !== undefined) {
        throw Error(ERROR.recordAlreadyExists(collectionName, input.id))
      }

      const stagedRecord = either.data as CommonDoc

      await collection.replaceOne({ id: input.id }, stagedRecord, {
        upsert: true,
        session,
      })

      await __uuid.insertOne({ id: input.id }, { session })

      return (await get({ id: stagedRecord.id }, session))[0]
    }

    const put = async (
      input: CommonDoc,
      session: ClientSession | undefined,
      userId: string | undefined
    ) => {
      const timestamp = Date.now()

      input.updatedAt = timestamp

      if (userId) {
        input.updatedBy = userId
      }

      const either = tox.parse(input)

      if (either.success === false) {
        throw either.error
      }

      const [record] = await get({ id: input.id }, session)

      if (record === undefined) {
        throw new Error(ERROR.recordNotExists(collectionName, input.id))
      }

      const stagedRecord = either.data as CommonDoc

      for (const key of schemaKeys) {
        // @ts-expect-error absent props must be set to undefined
        stagedRecord[key] = stagedRecord[key] ?? undefined
      }

      await collection.replaceOne({ id: input.id }, stagedRecord, {
        upsert: false,
        session,
      })

      return (await get({ id: stagedRecord.id }, session))[0]
    }

    const remove = async (
      idOrIds: string | Array<string>,
      session: ClientSession | undefined
    ) => {
      const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds]

      await Promise.all(
        ids.map((id) =>
          collection
            .deleteOne({ id }, { session })
            .then(() => __uuid.deleteOne({ id }, { session }))
        )
      )

      return undefined
    }

    /**
     * Use "mongodb" driver directly
     **/
    const mongo = (session?: ClientSession, userId?: string) => ({
      collection,
      session,
      userId,
    })

    result[collectionName] = {
      get,
      mongo,
      post,
      put,
      remove,
      tox,
    }
  }

  result._wrap = (session?: ClientSession, userId?: string) =>
    getModifiedRepo(result, session, userId)

  return result
}
