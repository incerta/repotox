import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as x from 'schematox'
import { initRepoHelper, connectDB, dropDB } from './test-helpers'

import type { Infer } from 'schematox'

describe('initRepo', () => {
  beforeEach(connectDB)
  afterEach(dropDB)

  it('maps each model to its own named MongoDB collection', async () => {
    const modelA = x.object({ id: x.number() })
    const modelB = x.object({ id: x.number() })

    const repo = initRepoHelper({ modelA, modelB })

    await repo.modelA.collection.insertOne({ id: 1 })
    await repo.modelB.collection.insertOne({ id: 2 })

    expect(repo.modelA.collection.collectionName).toBe('modelA')
    expect(repo.modelB.collection.collectionName).toBe('modelB')

    const [foundInA] = await repo.modelA.collection.find({}).toArray()
    const [foundInB] = await repo.modelB.collection.find({}).toArray()

    expect(foundInA?.id).toBe(1)
    expect(foundInB?.id).toBe(2)
  })

  it('exposes the exact schema instance passed in', () => {
    const modelA = x.object({ id: x.number(), name: x.string() })

    const repo = initRepoHelper({ modelA })

    expect(repo.modelA.schema).toBe(modelA)
  })

  it('exposed schema still validates data via "parse"', () => {
    const modelA = x.object({ id: x.number(), name: x.string() })

    const repo = initRepoHelper({ modelA })

    const valid = repo.modelA.schema.parse({ id: 1, name: 'a' })
    const invalid = repo.modelA.schema.parse({ id: 1 })

    expect(valid.success).toBe(true)
    expect(invalid.success).toBe(false)
  })

  it('accepts discriminated union schemas', async () => {
    const modelA = x.union([
      x.object({
        id: x.number(),
        kind: x.literal('variantA'),
        variantAOnly: x.string(),
      }),

      x.object({
        id: x.number(),
        kind: x.literal('variantB'),
        variantBOnly: x.number(),
      }),
    ])

    const samples = [
      { id: 0, kind: 'variantA', variantAOnly: 'variantAOnly_value' },
      { id: 1, kind: 'variantB', variantBOnly: 0 },
    ] satisfies Array<Infer<typeof modelA>>

    const repo = initRepoHelper({ modelA })

    await repo.modelA.collection.insertMany(samples.map((x) => ({ ...x })))

    const actual = await repo.modelA.collection.find({}).toArray()

    expect(actual).toHaveLength(2)
  })
})
