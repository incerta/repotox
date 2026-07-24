import { MongoClient } from 'mongodb'
import { initRepo } from '../src/repo.js'

import type { RepoTox } from '../src/types.ts'

const DB_NAME = 'repotox_test_db'

let connection: ReturnType<typeof dbConnect> extends Promise<infer T>
  ? T
  : never | undefined

export async function connectDB() {
  connection = await dbConnect()
  await connection.db(DB_NAME).dropDatabase()
}

export async function dropDB() {
  if (connection !== undefined) {
    await connection.db(DB_NAME).dropDatabase()
    await connection.close()
  }
}

export function initRepoHelper<T extends Record<string, RepoTox>>(models: T) {
  if (connection === undefined) {
    throw new Error('Apply `beforeEach(connectDB)` and `afterEach(dropDB)`')
  }

  return initRepo(connection, DB_NAME, models)
}

export async function dbConnect() {
  const uri = process.env.MONGO_URI

  if (uri === undefined) {
    throw new Error(
      'MONGO_URI is not set - is the vitest "globalSetup" running?'
    )
  }

  return await MongoClient.connect(uri, { retryWrites: false })
}
