import { MongoMemoryServer } from 'mongodb-memory-server'

export default async function setup() {
  const mongod = await MongoMemoryServer.create({
    // The default (latest) binary requires a newer macOS/libc++ than some
    // dev machines ship with, and crashes with SIGABRT on startup. 7.0.x
    // is broadly compatible and well within the mongodb driver's support.
    binary: { version: '7.0.14' },
  })

  process.env.MONGO_URI = mongod.getUri()

  return async () => {
    await mongod.stop()
  }
}
