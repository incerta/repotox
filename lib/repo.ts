import { ERROR, USED_UUID_SYSTEM_COLLECTION } from './constants'
import {
  getCollectionForeignKeyRelations,
  sanitizeMongoRecord,
  getModifiedRepo,
} from './utils'

import type { ClientSession, MongoClient } from 'mongodb'

import type {
  CommonDoc,
  InitRepo,
  MutationReport,
  RepoTox,
  SafeRemoveResult,
} from './types'

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
    const { tox, schemaKeys, relations } = getCollectionForeignKeyRelations(
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

      if (either.left) {
        throw either.left
      }

      const uuid = await __uuid.findOne({ id: input.id })

      if (uuid !== null) {
        throw Error(ERROR.idIsAlreadyTaken(uuid.id))
      }

      const [record] = await get({ id: input.id }, session)

      if (record !== undefined) {
        throw Error(ERROR.recordAlreadyExists(collectionName, input.id))
      }

      const stagedRecord = either.right as CommonDoc

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

      if (either.left) {
        throw either.left
      }

      const [record] = await get({ id: input.id }, session)

      if (record === undefined) {
        throw new Error(ERROR.recordNotExists(collectionName, input.id))
      }

      const stagedRecord = either.right as CommonDoc

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

    const safeRemove = async (
      id: string,
      session: ClientSession | undefined,
      userId: string | undefined
    ) => {
      const stagedForRemove = [] as MutationReport[]
      const stagedForUpdate = [] as MutationReport[]

      const confirmQueue = [] as Array<() => Promise<SafeRemoveResult>>
      const updateQueue = [] as Array<() => Promise<MutationReport[]>>

      const [sourceRecord] = await get({ id }, session)

      if (sourceRecord === undefined) {
        throw Error('Missing source record')
      }

      for (const relation of relations) {
        switch (relation.dependencyKind) {
          case 'primary-to-secondary': {
            const targetCollection = result[relation.targetCollectionName]

            if (targetCollection === undefined) {
              throw Error('Missing targetCollection')
            }

            const records = (await targetCollection.get(
              {
                [relation.targetCollectionFieldKey]: (() => {
                  switch (relation.cardinalityType) {
                    case 'one-to-one':
                    case 'many-to-one': {
                      return id
                    }

                    default: {
                      throw Error(
                        `Not supported relation cardinality type: ${relation.cardinalityType}`
                      )
                    }
                  }
                })(),
              },
              session
            )) as CommonDoc[]

            for (const record of records) {
              stagedForRemove.push([relation.targetCollectionName, record.id])

              const deepRemove = await targetCollection.safeRemove(record.id)

              confirmQueue.push(deepRemove.confirm)

              if (deepRemove.stagedForRemove) {
                for (const x of deepRemove.stagedForRemove) {
                  stagedForRemove.push(x)
                }
              }
            }

            break
          }

          case 'secondary-to-primary': {
            const targetCollection = result[relation.targetCollectionName]!

            if (targetCollection === undefined) {
              throw Error('Missing targetCollection')
            }

            switch (relation.cardinalityType) {
              case 'one-to-one': {
                const targetId = sourceRecord[relation.sourceCollectionFieldKey]

                if (targetId === undefined) {
                  throw Error('Missing targetId')
                }

                const [targetInitial] = (await targetCollection.get({
                  id: targetId,
                })) as Array<Record<string, unknown> | undefined>

                if (targetInitial === undefined) {
                  break
                }

                const hasReference =
                  targetInitial[relation.targetCollectionFieldKey] === id

                if (hasReference) {
                  const feedback = [
                    relation.targetCollectionName,
                    targetId,
                  ] as MutationReport

                  updateQueue.push(async () => {
                    targetCollection.put(
                      {
                        ...targetInitial,
                        [relation.targetCollectionFieldKey]: undefined,
                      },
                      session,
                      userId
                    )

                    return [feedback] as const
                  })

                  stagedForUpdate.push(feedback)
                  break
                }

                break
              }

              case 'one-to-many': {
                const targetId = sourceRecord[relation.sourceCollectionFieldKey]
                const [targetInitial] = (await targetCollection.get({
                  id: targetId,
                })) as Array<Record<string, any>>

                if (targetInitial === undefined) {
                  break
                }

                const hasReference =
                  targetInitial[relation.targetCollectionFieldKey]?.includes(id)

                if (hasReference) {
                  const feedback = [
                    relation.targetCollectionName,
                    targetId,
                  ] as MutationReport

                  updateQueue.push(async () => {
                    const updatedTarget = {
                      ...targetInitial,
                      [relation.targetCollectionFieldKey]: targetInitial[
                        relation.targetCollectionFieldKey
                      ].filter((referenceId: string) => referenceId !== id),
                    }

                    targetCollection.put(updatedTarget, session, userId)

                    return [feedback] as const
                  })

                  stagedForUpdate.push(feedback)
                }

                break
              }
            }

            break
          }

          default: {
            console.info(id, relation)
            throw Error(
              `Not supported relation dependencyKind: ${relation.dependencyKind}`
            )
          }
        }
      }

      return {
        stagedForRemove: stagedForRemove.length ? stagedForRemove : undefined,
        stagedForUpdate: stagedForUpdate.length ? stagedForUpdate : undefined,

        confirm: async () => {
          const result: SafeRemoveResult = {
            removed: [],
            updated: [],
          }

          for (const confirm of confirmQueue) {
            const confirmed = await confirm()

            result.removed = result.removed.concat(confirmed.removed)

            if (confirmed.updated) {
              result.updated = (result.updated || []).concat(confirmed.updated)
            }
          }

          for (const update of updateQueue) {
            const updates = await update()
            result.updated = (result.updated || []).concat(updates)
          }

          await remove(id, session)

          result.removed.push([collectionName, id])

          const deduplicatedResult: SafeRemoveResult = {
            removed: [],
            updated: [],
          }

          const getUniqueId = (x: MutationReport) => x[0] + x[1]

          const removedUniqueIds = new Set<string>()

          for (const change of result.removed) {
            const uniqueId = getUniqueId(change)

            if (removedUniqueIds.has(uniqueId)) {
              continue
            }

            removedUniqueIds.add(uniqueId)
            deduplicatedResult.removed.push(change)
          }

          const updatedUniqueIds = new Set<string>()

          if (result.updated) {
            for (const change of result.updated) {
              const [brand, recordId] = change
              const uniqueId = brand + recordId

              if (
                updatedUniqueIds.has(uniqueId) ||
                removedUniqueIds.has(uniqueId)
              ) {
                continue
              }

              updatedUniqueIds.add(uniqueId)
              deduplicatedResult.updated?.push(change)
            }
          }

          if (deduplicatedResult.updated?.length === 0) {
            delete deduplicatedResult.updated
          }

          return deduplicatedResult
        },
      }
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
      relations,
      remove,
      safeRemove,
      tox,
    }
  }

  result._wrap = (session?: ClientSession, userId?: string) =>
    getModifiedRepo(result, session, userId)

  return result
}
