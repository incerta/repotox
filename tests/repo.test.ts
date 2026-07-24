import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as x from 'schematox'
import { ERROR } from '../lib/constants'
import { initRepoHelper, connectDB, dropDB } from './test-helpers'

import type { Infer } from 'schematox'

const sort = <T extends { id: number }>(a: T, b: T) => a.id - b.id
const clone = <T extends Record<string, unknown>>(x: T) => ({ ...x })

describe('Repository initialization process', () => {
  beforeEach(connectDB)
  afterEach(dropDB)

  it('Check discriminated union schema', async () => {
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

    const repo = await initRepoHelper({ modelA })
    const { collection } = repo.modelA.mongo()

    await collection.insertMany(samples.map(clone))

    const expected = [samples[0], samples[1]]

    const actual = await repo.modelA.get()

    actual.sort(sort)

    expect(actual).toStrictEqual(expected)
  })
})

describe('Repo model "post" method', () => {
  beforeEach(connectDB)
  afterEach(dropDB)

  it('Should throw if input does not satisfy model tox requirements', async () => {
    const modelA = x.object({ id: x.number(), x: x.string() })
    const repo = await initRepoHelper({ modelA })

    // @ts-expect-error Property 'x' is missing in type '{ id: number; }'
    expect(() => repo.modelA.post({ id: 0 })).rejects.toBeTruthy()
  })

  it('Should throw if not unique record id is found', async () => {
    const modelA = x.object({ id: x.number() })
    const repo = await initRepoHelper({ modelA })

    await repo.modelA.post({ id: 0 })
    expect(() => repo.modelA.post({ id: 0 })).rejects.toThrow(
      ERROR.idIsAlreadyTaken(0)
    )
  })

  it('Should set "updatedAt" property automatically', async () => {
    const model = x.object({
      id: x.number(),
      updatedAt: x.number().optional(),
    })

    const repo = await initRepoHelper({ model })
    const record = await repo.model.post({ id: 0 })

    expect(typeof record.updatedAt).toBe('number')
  })

  it('Should set "createdAt" property automatically', async () => {
    const model = x.object({
      id: x.number(),
      createdAt: x.number().optional(),
    })

    const repo = await initRepoHelper({ model })
    const record = await repo.model.post({ id: 0 })

    expect(typeof record.createdAt).toBe('number')
  })

  it('Should set "createdBy" property automatically if "userId" provided', async () => {
    const model = x.object({
      id: x.number(),
      createdBy: x.string().optional(),
    })

    const userId = 'user-id-sample'

    const repo = await initRepoHelper({ model })
    const record = await repo.model.post({ id: 0 }, undefined, userId)

    expect(record.createdBy).toBe(userId)
  })

  it('Should set "updatedBy" property automatically if "userId" provided', async () => {
    const model = x.object({
      id: x.number(),
      updatedBy: x.string().optional(),
    })

    const userId = 'user-id-sample'

    const repo = await initRepoHelper({ model })
    const record = await repo.model.post({ id: 0 }, undefined, userId)

    expect(record.updatedBy).toBe(userId)
  })
})

describe('Repo model "put" method', () => {
  beforeEach(connectDB)
  afterEach(dropDB)

  it('Should throw if input does not satisfy model tox requirements', async () => {
    const modelA = x.object({ id: x.number(), x: x.string() })
    const repo = await initRepoHelper({ modelA })

    await repo.modelA.post({ id: 0, x: 'x-value' })

    // @ts-expect-error Property 'x' is missing in type '{ id: number; }'
    expect(() => repo.modelA.put({ id: 0 })).rejects.toBeTruthy()
  })

  it('Should throw if required property is not exist', async () => {
    const modelA = x.object({ id: x.number() })
    const repo = await initRepoHelper({ modelA })

    expect(() => repo.modelA.put({ id: 0 })).rejects.toThrow(
      ERROR.recordNotExists('modelA', 0)
    )
  })

  it('Should set "updatedAt" property automatically', async () => {
    const modelA = x.object({
      id: x.number(),
      updatedAt: x.number().optional(),
    })

    const repo = await initRepoHelper({ modelA })

    const createdRecord = await repo.modelA.post({ id: 0 })
    const updatedRecord = await repo.modelA.put({ id: 0 })

    expect(createdRecord.updatedAt).not.toBe(updatedRecord.updatedAt)
  })

  it('Should not set "updatedAt" property automatically if the model has no such property', async () => {
    const modelA = x.object({ id: x.number() })

    const repo = await initRepoHelper({ modelA })
    await repo.modelA.post({ id: 0 })

    const updatedRecord = await repo.modelA.put({ id: 0 })

    expect('updatedAt' in updatedRecord).toBe(false)
  })

  it('Should set "updatedBy" property automatically if "userId" provided', async () => {
    const modelA = x.object({
      id: x.number(),
      updatedBy: x.string().optional(),
    })

    const creatorUserId = 'user-id-creator-sample'
    const updaterUserId = 'user-id-updater-sample'

    const repo = await initRepoHelper({ modelA })
    await repo.modelA.post({ id: 0 }, undefined, creatorUserId)
    const updatedRecord = await repo.modelA.put(
      { id: 0 },
      undefined,
      updaterUserId
    )

    expect(updatedRecord.updatedBy).toBe(updaterUserId)
  })

  it('Should not set the "updatedBy" property automatically if "userId" is not provided', async () => {
    const modelA = x.object({
      id: x.number(),
      updatedBy: x.string().optional(),
    })

    const repo = await initRepoHelper({ modelA })
    await repo.modelA.post({ id: 0 }, undefined)
    const updatedRecord = await repo.modelA.put({ id: 0 }, undefined)

    expect('updatedBy' in updatedRecord).toBe(false)
  })

  it('Should not automatically set the "updatedBy" property if the model has no such property', async () => {
    const modelA = x.object({ id: x.number() })
    const userIdSample = 'user-id-sample'

    const repo = await initRepoHelper({ modelA })
    await repo.modelA.post({ id: 0 }, undefined, userIdSample)
    const updatedRecord = await repo.modelA.put(
      { id: 0 },
      undefined,
      userIdSample
    )

    expect('updatedBy' in updatedRecord).toBe(false)
  })

  it('Should set not specified property values to undefined', async () => {
    const sample = x.object({
      id: x.number(),
      a: x.string().optional(),
      b: x.string().optional(),
    })

    const repo = await initRepoHelper({ sample })

    const original = {
      id: 1,
      a: 'aValue',
    }

    await repo.sample.post(original)

    const override = {
      id: 1,
      b: 'bValue',
    }

    await repo.sample.put(override)

    const expected = {
      id: 1,
      b: 'bValue',
    }

    const [actual] = await repo.sample.get({ id: 1 })

    expect(actual).toStrictEqual(expected)
  })
})

describe('Repo model "remove" method', () => {
  beforeEach(connectDB)
  afterEach(dropDB)

  it('Should remove singular record by its id', async () => {
    const id = x.number().brand('id', 'modelA')

    type Id = Infer<typeof id>

    const modelA = x.object({ id })

    const repo = await initRepoHelper({ modelA })

    const samples = [
      { id: 1 as Id },
      { id: 2 as Id },
      { id: 3 as Id },
      { id: 4 as Id },
    ] satisfies Array<Infer<typeof modelA>>

    await repo.modelA.mongo().collection.insertMany(samples)
    await repo.modelA.remove(3 as Id)

    const expected = [{ id: 1 }, { id: 2 }, { id: 4 }]

    const result = await repo.modelA.mongo().collection.find({}).toArray()
    const actual = result.map(({ id }) => ({ id })).sort((a, b) => a.id - b.id)

    expect(actual).toStrictEqual(expected)
  })

  it('Should remove records multiple records in one instruction', async () => {
    const modelA = x.object({ id: x.number() })

    const repo = await initRepoHelper({ modelA })

    const samples = [
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
    ] satisfies Array<Infer<typeof modelA>>

    await repo.modelA.mongo().collection.insertMany(samples)
    await repo.modelA.remove([2, 3])

    const expected = [{ id: 1 }, { id: 4 }]

    const result = await repo.modelA.mongo().collection.find({}).toArray()
    const actual = result.map(({ id }) => ({ id })).sort((a, b) => a.id - b.id)

    expect(actual).toStrictEqual(expected)
  })
})

describe('Repo model "get" method', () => {
  beforeEach(connectDB)
  afterEach(dropDB)

  it('no filtering', async () => {
    const modelA = x.object({ id: x.number() })
    const repo = await initRepoHelper({ modelA })
    const collection = repo.modelA.mongo().collection

    const samples = [{ id: 1 }, { id: 2 }] satisfies Array<Infer<typeof modelA>>

    await collection.insertMany(samples.map(clone))

    const expected = samples
    const actual = await repo.modelA.get()

    expected.sort(sort)
    actual.sort(sort)

    expect(actual).toStrictEqual(expected)
  })

  it('two fields eq direct lookup', async () => {
    const modelA = x.object({ id: x.number(), a: x.string(), b: x.string() })
    const repo = await initRepoHelper({ modelA })
    const collection = repo.modelA.mongo().collection

    const samples = [
      { id: 1, a: '1-a', b: '1-b' },
      { id: 2, a: '2-a', b: '2-b' },
    ] satisfies Array<Infer<typeof modelA>>

    await collection.insertMany(samples.map(clone))

    const expected = samples[1]
    const [actual] = await repo.modelA.get({
      a: '2-a',
      b: '2-b',
    })

    expect(actual).toStrictEqual(expected)
  })

  describe('Comparison operators', () => {
    describe('$eq', () => {
      it('singular field filter', async () => {
        const modelA = x.object({ id: x.number() })
        const repo = await initRepoHelper({ modelA })
        const collection = repo.modelA.mongo().collection

        const samples = [{ id: 1 }, { id: 2 }] satisfies Array<
          Infer<typeof modelA>
        >

        await collection.insertMany(samples.map(clone))

        const expected = [samples[1]]
        const actual = await repo.modelA.get({ id: { $eq: 2 } })

        expect(actual).toStrictEqual(expected)
      })

      it('non existed value lookup', async () => {
        const modelA = x.object({ id: x.number() })
        const repo = await initRepoHelper({ modelA })
        const collection = repo.modelA.mongo().collection

        const samples = [{ id: 1 }, { id: 2 }] satisfies Array<
          Infer<typeof modelA>
        >

        await collection.insertMany(samples.map(clone))

        const expected = [] as typeof samples
        const actual = await repo.modelA.get({ id: { $eq: 3 } })

        expect(actual).toStrictEqual(expected)
      })

      it('undefined value lookup', async () => {
        const modelA = x.object({ id: x.number(), x: x.string().optional() })
        const repo = await initRepoHelper({ modelA })
        const collection = repo.modelA.mongo().collection

        const samples = [
          { id: 1 },
          { id: 2, x: 'A' },
          { id: 3 },
        ] satisfies Array<Infer<typeof modelA>>

        await collection.insertMany(samples.map(clone))

        const expected = [samples[0], samples[2]]
        const actual = await repo.modelA.get({ x: undefined })

        expect(actual).toStrictEqual(expected)
      })

      it('implicit $eq', async () => {
        const modelA = x.object({ id: x.number() })
        const repo = await initRepoHelper({ modelA })
        const collection = repo.modelA.mongo().collection

        const samples = [{ id: 1 }, { id: 2 }] satisfies Array<
          Infer<typeof modelA>
        >

        await collection.insertMany(samples.map(clone))

        const expected = [samples[1]]
        const actual = await repo.modelA.get({ id: 2 })

        expect(actual).toStrictEqual(expected)
      })

      it('multiple fields filter', async () => {
        const modelA = x.object({ id: x.number(), x: x.string() })
        const repo = await initRepoHelper({ modelA })
        const collection = repo.modelA.mongo().collection

        const samples = [
          { id: 1, x: 'a' },
          { id: 2, x: 'b' },
          { id: 3, x: 'b' },
        ] satisfies Array<Infer<typeof modelA>>

        await collection.insertMany(samples.map(clone))

        const expected = [samples[1]!]
        const actual = await repo.modelA.get({ id: 2, x: 'b' })

        expected.sort(sort)
        actual.sort(sort)

        expect(actual).toStrictEqual(expected)
      })
    })

    it('$in', async () => {
      const modelA = x.object({ id: x.number() })
      const repo = await initRepoHelper({ modelA })
      const collection = repo.modelA.mongo().collection

      const samples = [{ id: 1 }, { id: 2 }, { id: 3 }] satisfies Array<
        Infer<typeof modelA>
      >

      await collection.insertMany(samples.map(clone))

      const expected = [samples[0], samples[2]]
      const actual = await repo.modelA.get({ id: { $in: [1, 3] } })

      expect(actual).toStrictEqual(expected)
    })
  })

  describe('Logical operators', () => {
    it('$or', async () => {
      const modelA = x.object({ id: x.number(), x: x.boolean().optional() })
      const repo = await initRepoHelper({ modelA })
      const collection = repo.modelA.mongo().collection

      const samples = [
        { id: 1, x: true },
        { id: 2, x: false },
        { id: 3, x: undefined },
        { id: 4 },
      ] satisfies Array<Infer<typeof modelA>>

      await collection.insertMany(samples.map(clone))

      const expected = [samples[1]!, { id: 3 }, samples[3]!]
      const actual = await repo.modelA.get({
        $or: [{ x: undefined }, { x: false }],
      })

      expected.sort(sort)
      actual.sort(sort)

      expect(actual).toStrictEqual(expected)
    })

    it('$not', async () => {
      const modelA = x.object({ id: x.number(), x: x.boolean().optional() })
      const repo = await initRepoHelper({ modelA })
      const collection = repo.modelA.mongo().collection

      const samples = [
        { id: 1, x: true },
        { id: 2, x: false },
        { id: 3, x: undefined },
        { id: 4 },
      ] satisfies Array<Infer<typeof modelA>>

      await collection.insertMany(samples.map(clone))

      const expected = [samples[1]!, { id: 3 }, samples[3]!]
      const actual = await repo.modelA.get({
        x: { $not: { $eq: true } },
      })

      expected.sort(sort)
      actual.sort(sort)

      expect(actual).toStrictEqual(expected)
    })

    it('($not -> $eq) + $gt', async () => {
      const modelA = x.object({ id: x.number(), x: x.boolean().optional() })
      const repo = await initRepoHelper({ modelA })
      const collection = repo.modelA.mongo().collection

      const samples = [
        { id: 1, x: true },
        { id: 2, x: false },
        { id: 3, x: undefined },
        { id: 4 },
      ] satisfies Array<Infer<typeof modelA>>

      await collection.insertMany(samples.map(clone))

      const expected = [{ id: 3 }, samples[3]!]
      const actual = await repo.modelA.get({
        x: { $not: { $eq: true } },
        id: { $gt: 2 },
      })

      expected.sort(sort)
      actual.sort(sort)

      expect(actual).toStrictEqual(expected)
    })

    it('$nor', async () => {
      const modelA = x.object({ id: x.number(), x: x.boolean().optional() })
      const repo = await initRepoHelper({ modelA })
      const collection = repo.modelA.mongo().collection

      const samples = [
        { id: 0, x: true },
        { id: 1, x: false },
        { id: 2 },
        { id: 3 },
      ] satisfies Array<Infer<typeof modelA>>

      await collection.insertMany(samples.map(clone))

      const expected = [samples[2]!]
      const actual = await repo.modelA.get({
        $nor: [{ id: { $lte: 1 } }, { id: 3 }],
      })

      expected.sort(sort)
      actual.sort(sort)

      expect(actual).toStrictEqual(expected)
    })
  })

  describe('Field value type specific', () => {
    describe('Array', () => {
      it('$eq explicit', async () => {
        const modelA = x.object({ id: x.number(), x: x.array(x.string()) })
        const repo = await initRepoHelper({ modelA })
        const collection = repo.modelA.mongo().collection

        const samples = [
          { id: 0, x: ['a', 'b'] },
          { id: 1, x: ['b', 'a'] },
        ] satisfies Array<Infer<typeof modelA>>

        await collection.insertMany(samples.map(clone))

        const expected = [samples[1]]
        const actual = await repo.modelA.get({
          x: { $eq: ['b', 'a'] },
        })

        expect(actual).toStrictEqual(expected)
      })

      it('$eq implicit', async () => {
        const modelA = x.object({ id: x.number(), x: x.array(x.string()) })
        const repo = await initRepoHelper({ modelA })
        const collection = repo.modelA.mongo().collection

        const samples = [
          { id: 0, x: ['a', 'b'] },
          { id: 1, x: ['b', 'a'] },
        ] satisfies Array<Infer<typeof modelA>>

        await collection.insertMany(samples.map(clone))

        const expected = [samples[1]]
        const actual = await repo.modelA.get({
          x: ['b', 'a'],
        })

        expect(actual).toStrictEqual(expected)
      })

      it('$in', async () => {
        const modelA = x.object({ id: x.number(), x: x.array(x.string()) })
        const repo = await initRepoHelper({ modelA })
        const collection = repo.modelA.mongo().collection

        const samples = [
          { id: 0, x: [] },
          { id: 1, x: ['a'] },
          { id: 2, x: ['a', 'b'] },
          { id: 3, x: ['b', 'a'] },
        ] satisfies Array<Infer<typeof modelA>>

        await collection.insertMany(samples.map(clone))

        const expected = [samples[0], samples[1], samples[3]]
        const actual = await repo.modelA.get({
          x: { $in: [[], ['a'], ['b', 'a']] },
        })

        expect(actual).toStrictEqual(expected)
      })

      it('$all', async () => {
        const modelA = x.object({ id: x.number(), x: x.array(x.string()) })
        const repo = await initRepoHelper({ modelA })
        const collection = repo.modelA.mongo().collection

        const samples = [
          { id: 0, x: [] },
          { id: 1, x: ['a'] },
          { id: 2, x: ['a', 'b'] },
          { id: 3, x: ['b', 'a'] },
          { id: 4, x: ['b'] },
        ] satisfies Array<Infer<typeof modelA>>

        await collection.insertMany(samples.map(clone))

        const expected = [samples[2], samples[3]]
        const actual = await repo.modelA.get({
          x: { $all: ['a', 'b'] },
        })

        expect(actual).toStrictEqual(expected)
      })
    })
  })

  describe('Deeply nested filtering operation examples', () => {
    it('double $not', async () => {
      const modelA = x.object({ id: x.number(), x: x.string().optional() })
      const repo = await initRepoHelper({ modelA })
      const collection = repo.modelA.mongo().collection

      const samples = [{ id: 0 }, { id: 1, x: 'A' }, { id: 2 }] satisfies Array<
        Infer<typeof modelA>
      >

      await collection.insertMany(samples.map(clone))

      const expected = [samples[0]!]
      const actual = await repo.modelA.get({
        $and: [
          //
          {
            $or: [{ id: { $in: [0] } }, { id: { $in: [2] } }],
          },

          //
          { id: { $not: { $not: { $ne: 2 } } } },
        ],
      })

      expected.sort(sort)
      actual.sort(sort)

      expect(actual).toStrictEqual(expected)
    })
  })
})
