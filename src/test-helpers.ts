import { MongoClient } from 'mongodb'
import { initRepo } from './repo'

import type { RepoTox } from './types'

const DB_NAME = 'repotox_test_db'

/* Check if U extends T */
export const check = <T, U extends T = T>(...x: T[]): U[] => x as U[]

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

export async function initRepoHelper<T extends Record<string, RepoTox>>(
  models: T
) {
  if (connection === undefined) {
    throw new Error('Apply `beforeEach(connectDB)` and `afterEach(dropDB)`')
  }

  return await initRepo(connection, DB_NAME, models)
}

export async function dbConnect() {
  const dbUrl = `mongodb://root:root@localhost/?authSource=admin&retryWrites=false`
  return await MongoClient.connect(dbUrl)
}
