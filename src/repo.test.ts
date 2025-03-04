import {
  array,
  boolean,
  literal,
  number,
  object,
  string,
  union,
} from 'schematox'

import { initRepoHelper, connectDB, dropDB } from './test-helpers'
import { ERROR, IGNORE_RELATION, FOREIGN_KEY_BRAND_TYPE } from './constants'

import type { SubjectType } from 'schematox'

const sort = <T extends { id: number }>(a: T, b: T) => a.id - b.id
const clone = <T extends Record<string, unknown>>(x: T) => ({ ...x })

describe('Repository initialization process', () => {
  beforeEach(connectDB)
  afterEach(dropDB)

  it('Check discriminated union schema', async () => {
    const modelA = union([
      object({
        id: number(),
        kind: literal('variantA'),
        variantAOnly: string(),
      }),

      object({
        id: number(),
        kind: literal('variantB'),
        variantBOnly: number(),
      }),
    ])

    const samples = [
      { id: 0, kind: 'variantA', variantAOnly: 'variantAOnly_value' },
      { id: 1, kind: 'variantB', variantBOnly: 0 },
    ] satisfies Array<SubjectType<typeof modelA>>

    const repo = await initRepoHelper({ modelA })
    const { collection } = repo.modelA.mongo()

    await collection.insertMany(samples.map(clone))

    const expected = [samples[0], samples[1]]

    const actual = await repo.modelA.get()

    actual.sort(sort)

    expect(actual).toStrictEqual(expected)
  })
})

describe('Detection of missing user-defined relations', () => {
  beforeEach(connectDB)
  afterEach(dropDB)

  describe('one-to-many and many-to-one cases', () => {
    it('skip case', () => {
      const modelAId = string().brand(FOREIGN_KEY_BRAND_TYPE, 'modelA')
      const modelBId = string().brand(FOREIGN_KEY_BRAND_TYPE, 'modelB')

      const modelA = object({
        id: modelAId,
        modelBIds: array(modelBId).description(IGNORE_RELATION),
      })

      const modelB = object({
        id: modelBId,
      })

      expect(() => initRepoHelper({ modelA, modelB })).not.toThrow()
    })

    it('valid primary-to-secondary', () => {
      const modelAId = string().brand(FOREIGN_KEY_BRAND_TYPE, 'modelA')
      const modelBId = string().brand(FOREIGN_KEY_BRAND_TYPE, 'modelB')

      const modelA = object({
        id: modelAId,
        modelBIds: array(modelBId).optional(),
      })

      const modelB = object({
        id: modelBId,
        modelAId: modelAId,
      })

      expect(() => initRepoHelper({ modelA, modelB })).not.toThrow()
    })

    it('error: secondary to secondary dependency relation is forbidden', () => {
      const modelAId = string().brand(FOREIGN_KEY_BRAND_TYPE, 'modelA')
      const modelBId = string().brand(FOREIGN_KEY_BRAND_TYPE, 'modelB')

      const modelA = object({
        id: modelAId,
        modelBIds: array(modelBId),
      })

      const modelB = object({
        id: modelBId,
        modelAId: modelAId,
      })

      expect(() => initRepoHelper({ modelA, modelB })).rejects.toThrow(
        ERROR.secondaryToSecondaryRelationIsForbidden('modelA', 'modelBIds')
      )
    })

    it('error: corresponding model has no user-defined relation', () => {
      const modelAId = string().brand(FOREIGN_KEY_BRAND_TYPE, 'modelA')
      const modelBId = string().brand(FOREIGN_KEY_BRAND_TYPE, 'modelB')

      const modelA = object({
        id: modelAId,
        modelBIds: array(modelBId),
      })

      const modelB = object({
        id: modelBId,
        /* missing "modelAId" */
      })

      expect(() => initRepoHelper({ modelA, modelB })).rejects.toThrow(
        ERROR.noUserDefinedRelation('modelB', 'modelA', 'modelBIds')
      )
    })

    it('error: corresponding model has no user-defined relation (mirror case)', () => {
      const modelAId = string().brand(FOREIGN_KEY_BRAND_TYPE, 'modelA')
      const modelBId = string().brand(FOREIGN_KEY_BRAND_TYPE, 'modelB')

      const modelA = object({
        id: modelAId,
        /* missing "modelBId" */
      })

      const modelB = object({
        id: modelBId,
        modelAIds: array(modelAId),
      })

      expect(() => initRepoHelper({ modelA, modelB })).rejects.toThrow(
        ERROR.noUserDefinedRelation('modelA', 'modelB', 'modelAIds')
      )
    })
  })

  describe('one-to-one relation', () => {
    it('skip case', async () => {
      const modelAId = string().brand(FOREIGN_KEY_BRAND_TYPE, 'modelA')
      const modelBId = string().brand(FOREIGN_KEY_BRAND_TYPE, 'modelB')

      const modelA = object({
        id: modelAId,
        modelBId: modelBId.description(IGNORE_RELATION),
      })

      const modelB = object({
        id: modelBId,
      })

      expect(() => initRepoHelper({ modelA, modelB })).not.toThrow()
    })

    it('valid primary-to-secondary', async () => {
      const modelAId = string().brand(FOREIGN_KEY_BRAND_TYPE, 'modelA')
      const modelBId = string().brand(FOREIGN_KEY_BRAND_TYPE, 'modelB')

      const modelA = object({
        id: modelAId,
        modelBId: modelBId,
      })

      const modelB = object({
        id: modelBId,
        modelAId: modelAId.optional(),
      })

      expect(() => initRepoHelper({ modelA, modelB })).not.toThrow()
    })

    it('valid primary-to-secondary union', async () => {
      const modelAId = string().brand(FOREIGN_KEY_BRAND_TYPE, 'modelA')
      const modelBId = string().brand(FOREIGN_KEY_BRAND_TYPE, 'modelB')

      const modelA = union([
        object({
          id: modelAId,
          modelBId: modelBId,
        }),
      ])

      const modelB = object({
        id: modelBId,
        modelAId: modelAId.optional(),
      })

      expect(() => initRepoHelper({ modelA, modelB })).not.toThrow()
    })

    it('error: secondary to secondary dependency relation is forbidden', async () => {
      const modelAId = string().brand(FOREIGN_KEY_BRAND_TYPE, 'modelA')
      const modelBId = string().brand(FOREIGN_KEY_BRAND_TYPE, 'modelB')

      const modelA = object({
        id: modelAId,
        modelBId: modelBId,
      })

      const modelB = object({
        id: modelBId,
        modelAId: modelAId,
      })

      expect(() => initRepoHelper({ modelA, modelB })).rejects.toThrow(
        ERROR.secondaryToSecondaryRelationIsForbidden('modelA', 'modelBId')
      )
    })

    it('error: corresponding modelB has no user-defined relation', async () => {
      const modelAId = string().brand(FOREIGN_KEY_BRAND_TYPE, 'modelA')
      const modelBId = string().brand(FOREIGN_KEY_BRAND_TYPE, 'modelB')

      const modelA = object({
        id: modelAId,
        modelBId: modelBId,
      })

      const modelB = object({
        id: modelBId,
        /* missing "modelAId" */
      })

      expect(initRepoHelper({ modelA, modelB })).rejects.toThrow(
        ERROR.noUserDefinedRelation('modelB', 'modelA', 'modelBId')
      )
    })

    it('error: corresponding modelB has no user-defined relation (mirror case)', async () => {
      const modelAId = string().brand(FOREIGN_KEY_BRAND_TYPE, 'modelA')
      const modelBId = string().brand(FOREIGN_KEY_BRAND_TYPE, 'modelB')

      const modelA = object({
        id: modelAId,
        /* missing "modelBId" */
      })

      const modelB = object({
        id: modelBId,
        modelAId: modelAId,
      })

      expect(initRepoHelper({ modelA, modelB })).rejects.toThrow(
        ERROR.noUserDefinedRelation('modelA', 'modelB', 'modelAId')
      )
    })
  })
})

describe('Repo model "post" method', () => {
  beforeEach(connectDB)
  afterEach(dropDB)

  it('Should throw if input does not satisfy model tox requirements', async () => {
    const modelA = object({ id: number(), x: string() })
    const repo = await initRepoHelper({ modelA })

    // @ts-expect-error Property 'x' is missing in type '{ id: number; }'
    expect(() => repo.modelA.post({ id: 0 })).rejects.toBeTruthy()
  })

  it('Should throw if not unique record id is found', async () => {
    const modelA = object({ id: number() })
    const repo = await initRepoHelper({ modelA })

    await repo.modelA.post({ id: 0 })
    expect(() => repo.modelA.post({ id: 0 })).rejects.toThrow(
      ERROR.idIsAlreadyTaken(0)
    )
  })

  it('Should set "updatedAt" property automatically', async () => {
    const model = object({
      id: number(),
      updatedAt: number().optional(),
    })

    const repo = await initRepoHelper({ model })
    const record = await repo.model.post({ id: 0 })

    expect(typeof record.updatedAt).toBe('number')
  })

  it('Should set "createdAt" property automatically', async () => {
    const model = object({
      id: number(),
      createdAt: number().optional(),
    })

    const repo = await initRepoHelper({ model })
    const record = await repo.model.post({ id: 0 })

    expect(typeof record.createdAt).toBe('number')
  })

  it('Should set "createdBy" property automatically if "userId" provided', async () => {
    const model = object({
      id: number(),
      createdBy: string().optional(),
    })

    const userId = 'user-id-sample'

    const repo = await initRepoHelper({ model })
    const record = await repo.model.post({ id: 0 }, undefined, userId)

    expect(record.createdBy).toBe(userId)
  })

  it('Should set "updatedBy" property automatically if "userId" provided', async () => {
    const model = object({
      id: number(),
      updatedBy: string().optional(),
    })

    const userId = 'user-id-sample'

    const repo = await initRepoHelper({ model })
    const record = await repo.model.post({ id: 0 }, undefined, userId)

    expect(record.updatedBy).toBe(userId)
  })

  it.skip('Must maintain "one-to-one" foreign key relation"', async () => {
    const modelAId = string().brand(FOREIGN_KEY_BRAND_TYPE, 'modelA')
    const modelBId = string().brand(FOREIGN_KEY_BRAND_TYPE, 'modelB')

    // if `modelBId` not optional I can't create the "parent" record
    // it will be a input data validation error
    const modelA = object({ id: modelAId, modelBId: modelBId.optional() })
    const modelB = object({ id: modelBId, modelAId })

    type ModelA = SubjectType<typeof modelA>
    type ModelAId = ModelA['id']

    type ModelB = SubjectType<typeof modelB>
    type ModelBId = ModelB['id']

    const modelASample = { id: 'A0' as ModelAId } satisfies ModelA
    const modelBSample = {
      id: 'B0' as ModelBId,
      modelAId: modelASample.id,
    } satisfies ModelB

    const repo = await initRepoHelper({ modelA, modelB })

    await repo.modelA.post(modelASample)
    await repo.modelB.post(modelBSample)

    const expected = { id: modelASample.id, modelBId: modelBSample.id }
    const [actual] = await repo.modelA.get({ id: modelASample.id })

    expect(actual).toStrictEqual(expected)
  })
})

describe('Repo model "put" method', () => {
  beforeEach(connectDB)
  afterEach(dropDB)

  it('Should throw if input does not satisfy model tox requirements', async () => {
    const modelA = object({ id: number(), x: string() })
    const repo = await initRepoHelper({ modelA })

    await repo.modelA.post({ id: 0, x: 'x-value' })

    // @ts-expect-error Property 'x' is missing in type '{ id: number; }'
    expect(() => repo.modelA.put({ id: 0 })).rejects.toBeTruthy()
  })

  it('Should throw if required property is not exist', async () => {
    const modelA = object({ id: number() })
    const repo = await initRepoHelper({ modelA })

    expect(() => repo.modelA.put({ id: 0 })).rejects.toThrow(
      ERROR.recordNotExists('modelA', 0)
    )
  })

  it('Should set "updatedAt" property automatically', async () => {
    const modelA = object({
      id: number(),
      updatedAt: number().optional(),
    })

    const repo = await initRepoHelper({ modelA })

    const createdRecord = await repo.modelA.post({ id: 0 })
    const updatedRecord = await repo.modelA.put({ id: 0 })

    expect(createdRecord.updatedAt).not.toBe(updatedRecord.updatedAt)
  })

  it('Should not set "updatedAt" property automatically if the model has no such property', async () => {
    const modelA = object({ id: number() })

    const repo = await initRepoHelper({ modelA })
    await repo.modelA.post({ id: 0 })

    const updatedRecord = await repo.modelA.put({ id: 0 })

    expect('updatedAt' in updatedRecord).toBe(false)
  })

  it('Should set "updatedBy" property automatically if "userId" provided', async () => {
    const modelA = object({
      id: number(),
      updatedBy: string().optional(),
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
    const modelA = object({
      id: number(),
      updatedBy: string().optional(),
    })

    const repo = await initRepoHelper({ modelA })
    await repo.modelA.post({ id: 0 }, undefined)
    const updatedRecord = await repo.modelA.put({ id: 0 }, undefined)

    expect('updatedBy' in updatedRecord).toBe(false)
  })

  it('Should not automatically set the "updatedBy" property if the model has no such property', async () => {
    const modelA = object({ id: number() })
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
    const sample = object({
      id: number(),
      a: string().optional(),
      b: string().optional(),
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
    const id = number().brand('id', 'modelA')

    type Id = SubjectType<typeof id>

    const modelA = object({ id })

    const repo = await initRepoHelper({ modelA })

    const samples = [
      { id: 1 as Id },
      { id: 2 as Id },
      { id: 3 as Id },
      { id: 4 as Id },
    ] satisfies Array<SubjectType<typeof modelA>>

    await repo.modelA.mongo().collection.insertMany(samples)
    await repo.modelA.remove(3 as Id)

    const expected = [{ id: 1 }, { id: 2 }, { id: 4 }]

    const result = await repo.modelA.mongo().collection.find({}).toArray()
    const actual = result.map(({ id }) => ({ id })).sort((a, b) => a.id - b.id)

    expect(actual).toStrictEqual(expected)
  })

  it('Should remove records multiple records in one instruction', async () => {
    const modelA = object({ id: number() })

    const repo = await initRepoHelper({ modelA })

    const samples = [
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
    ] satisfies Array<SubjectType<typeof modelA>>

    await repo.modelA.mongo().collection.insertMany(samples)
    await repo.modelA.remove([2, 3])

    const expected = [{ id: 1 }, { id: 4 }]

    const result = await repo.modelA.mongo().collection.find({}).toArray()
    const actual = result.map(({ id }) => ({ id })).sort((a, b) => a.id - b.id)

    expect(actual).toStrictEqual(expected)
  })
})

describe('Repo model "safeRemove" method', () => {
  beforeEach(connectDB)
  afterEach(dropDB)

  const model = {
    modelA: 'modelA',
    modelB: 'modelB',
    modelC: 'modelC',
    modelD: 'modelD',
    modelE: 'modelE',
  } as const

  const aId = string().brand(FOREIGN_KEY_BRAND_TYPE, model.modelA)
  const bId = string().brand(FOREIGN_KEY_BRAND_TYPE, model.modelB)
  const cId = string().brand(FOREIGN_KEY_BRAND_TYPE, model.modelC)
  const dId = string().brand(FOREIGN_KEY_BRAND_TYPE, model.modelD)

  it('dependant records must be staged for removal and removed after confirmation', async () => {
    const modelA = object({ id: aId, modelBId: bId.optional() })
    const modelB = object({ id: bId, modelAId: aId, modelCId: cId.optional() })
    const modelC = object({
      id: cId,
      modelBId: bId,
      modelDIds: array(dId).optional(),
    })

    const modelD = object({ id: dId, modelCId: cId })

    type A = SubjectType<typeof modelA>
    type B = SubjectType<typeof modelB>
    type C = SubjectType<typeof modelC>
    type D = SubjectType<typeof modelD>

    const repo = await initRepoHelper({ modelA, modelB, modelC, modelD })

    const samplesA = [
      { id: 'A1' as A['id'] },
      { id: 'A2' as A['id'] }, // index 1 should not be removed
    ] satisfies Array<A>

    const expectedA = [samplesA[1]]

    await repo.modelA.mongo().collection.insertMany(samplesA)

    const removeCId = 'C4' as C['id']

    const samplesB = [
      { id: 'B1' as B['id'], modelAId: samplesA[0]!.id },
      { id: 'B2' as B['id'], modelAId: samplesA[0]!.id },
      { id: 'B3' as B['id'], modelAId: samplesA[1]!.id, modelCId: removeCId }, // index 2 should not be removed
    ] satisfies Array<B>

    const expectedB = [{ ...samplesB[2] }] as typeof samplesB
    delete expectedB[0]!.modelCId

    await repo.modelB.mongo().collection.insertMany(samplesB)

    const removeDId = 'D4' as D['id']

    const samplesC = [
      { id: 'C1' as C['id'], modelBId: samplesB[0]!.id },
      {
        id: 'C2' as C['id'],
        modelBId: samplesB[2]!.id,
        modelDIds: [removeDId],
      }, // index 1 should not be removed
      { id: 'C3' as C['id'], modelBId: samplesB[0]!.id },
      { id: removeCId, modelBId: samplesB[2]!.id },
    ] satisfies Array<C>

    const expectedC = [{ ...samplesC[1] }] as typeof samplesC
    delete expectedC[0]!.modelDIds

    await repo.modelC.mongo().collection.insertMany(samplesC)

    const samplesD = [
      { id: 'D1' as D['id'], modelCId: samplesC[1]!.id }, // index 0 should not be removed
      { id: 'D2' as D['id'], modelCId: samplesC[0]!.id },
      { id: 'D3' as D['id'], modelCId: samplesC[2]!.id },
      { id: removeDId, modelCId: samplesC[1]!.id },
    ] satisfies Array<D>

    const expectedD = [samplesD[0]]

    await repo.modelD.mongo().collection.insertMany(samplesD)

    const sorter = (a: string[], b: string[]) => {
      const aComparator = a[1]!
      const bComparator = b[1]!
      return aComparator.localeCompare(bComparator)
    }

    // remove A1

    const safeRemoveA1 = await repo.modelA.safeRemove(samplesA[0]!.id)

    if (safeRemoveA1.stagedForRemove === undefined) {
      throw Error('Not expected')
    }

    const expectedStagedForSafeRemoveA1 = [
      [model.modelB, samplesB[0]!.id],
      [model.modelB, samplesB[1]!.id],
      [model.modelC, samplesC[0]!.id],
      [model.modelC, samplesC[2]!.id],
      [model.modelD, samplesD[1]!.id],
      [model.modelD, samplesD[2]!.id],
    ]

    expectedStagedForSafeRemoveA1.sort(sorter)
    safeRemoveA1.stagedForRemove.sort(sorter)

    expect(safeRemoveA1.stagedForRemove).toStrictEqual(
      expectedStagedForSafeRemoveA1
    )

    const safeRemoveA1Result = await safeRemoveA1.confirm()

    safeRemoveA1Result.removed.sort(sorter)
    safeRemoveA1Result.updated?.sort(sorter)

    expect(safeRemoveA1Result).toStrictEqual({
      removed: [
        ['modelA', 'A1'],
        ['modelB', 'B1'],
        ['modelB', 'B2'],
        ['modelC', 'C1'],
        ['modelC', 'C3'],
        ['modelD', 'D2'],
        ['modelD', 'D3'],
      ],
    })

    // remove C4

    const safeRemoveC4 = await repo.modelC.safeRemove(removeCId)

    if (safeRemoveC4.stagedForRemove !== undefined) {
      throw Error('Not expected')
    }

    const expectedStagedForUpdateSafeRemoveC4 = [
      [model.modelB, samplesB[2]!.id],
    ]

    expectedStagedForUpdateSafeRemoveC4.sort(sorter)
    safeRemoveC4.stagedForUpdate?.sort(sorter)

    expect(safeRemoveC4.stagedForUpdate).toStrictEqual(
      expectedStagedForUpdateSafeRemoveC4
    )

    const safeRemoveC4Result = await safeRemoveC4.confirm()

    safeRemoveC4Result.removed.sort(sorter)
    safeRemoveC4Result.updated?.sort(sorter)

    expect(safeRemoveC4Result).toStrictEqual({
      removed: [['modelC', 'C4']],
      updated: [['modelB', 'B3']],
    })

    // remove D4

    const safeRemoveD4 = await repo.modelD.safeRemove(removeDId)

    if (safeRemoveD4.stagedForRemove !== undefined) {
      throw Error('Not expected')
    }

    const expectedStagedForUpdateSafeRemoveD4 = [
      [model.modelC, samplesC[1]!.id],
    ]

    expectedStagedForUpdateSafeRemoveD4.sort(sorter)
    safeRemoveD4.stagedForUpdate?.sort(sorter)

    expect(safeRemoveD4.stagedForUpdate).toStrictEqual(
      expectedStagedForUpdateSafeRemoveD4
    )

    const safeRemoveD4Result = await safeRemoveD4.confirm()

    safeRemoveD4Result.removed.sort(sorter)
    safeRemoveD4Result.updated?.sort(sorter)

    expect(safeRemoveD4Result).toStrictEqual({
      removed: [['modelD', 'D4']],
      updated: [['modelC', 'C2']],
    })

    const actualA = await repo.modelA.mongo().collection.find({}).toArray()
    expect(actualA).toStrictEqual(expectedA)

    const actualB = await repo.modelB.mongo().collection.find({}).toArray()
    expect(actualB.map((x) => x.id)).toStrictEqual(expectedB.map((x) => x.id))

    const actualC = await repo.modelC.mongo().collection.find({}).toArray()
    expect(actualC.map((x) => x.id)).toStrictEqual(expectedC.map((x) => x.id))

    const actualD = await repo.modelD.mongo().collection.find({}).toArray()
    expect(actualD).toStrictEqual(expectedD)
  })

  it.skip('unilateral', async () => {
    const modelA = object({ id: aId })
    const modelB = object({ id: bId })

    const modelC = object({
      id: cId,
      resourceId: union([aId, bId]).description(IGNORE_RELATION),
    })

    const repo = await initRepoHelper({ modelA, modelB, modelC })

    type A = SubjectType<typeof modelA>
    type B = SubjectType<typeof modelB>
    type C = SubjectType<typeof modelC>

    const sorter = (a: string, b: string) => a.localeCompare(b)

    /* A */

    const samplesA = [
      { id: 'A0' as A['id'] }, // must be removed
      { id: 'A1' as A['id'] },
    ] satisfies A[]

    const expectedA = [samplesA[1]!] satisfies A[]

    await repo.modelA.mongo().collection.insertMany(samplesA)

    /* B */

    const samplesB = [
      { id: 'B0' as B['id'] },
      { id: 'B1' as B['id'] }, // must be removed
    ] satisfies B[]

    const expectedB = [samplesB[0]!] satisfies B[]

    await repo.modelB.mongo().collection.insertMany(samplesB)

    await repo.modelB.safeRemove(samplesB[1]!.id)

    /* C */

    const samplesC = [
      { id: 'C0' as C['id'], resourceId: samplesA[0]!.id }, // must be removed automatically
      { id: 'C1' as C['id'], resourceId: samplesA[1]!.id },

      { id: 'C2' as C['id'], resourceId: samplesB[1]!.id }, // must be removed automatically
      { id: 'C3' as C['id'], resourceId: samplesB[0]!.id },
    ] satisfies C[]

    const expectedC = [samplesC[1]!, samplesC[3]!] satisfies C[]

    await repo.modelC.mongo().collection.insertMany(samplesC)

    /* Action */

    const stagedForRemoveA = await repo.modelA.safeRemove(samplesA[0]!.id)

    expect(stagedForRemoveA.stagedForUpdate).toBeUndefined()
    expect(stagedForRemoveA.stagedForRemove).toStrictEqual([['C', 'C0']])

    const removeResultA = await stagedForRemoveA.confirm()

    expect(removeResultA.updated).toBeUndefined()
    expect(removeResultA.removed).toStrictEqual([
      ['A', 'A0'],
      ['C', 'C0'],
    ])

    await repo.modelC.safeRemove(samplesC[0]!.id)

    const actualB = await repo.modelB.mongo().collection.find({}).toArray()
    expect(actualB.map((x) => x.id).sort(sorter)).toStrictEqual(
      expectedB.map((x) => x.id).sort(sorter)
    )

    const actualA = await repo.modelA.mongo().collection.find({}).toArray()
    expect(actualA.map((x) => x.id).sort(sorter)).toStrictEqual(
      expectedA.map((x) => x.id).sort(sorter)
    )

    const actualC = await repo.modelC.mongo().collection.find({}).toArray()
    expect(actualC.map((x) => x.id).sort(sorter)).toStrictEqual(
      expectedC.map((x) => x.id).sort(sorter)
    )
  })
})

describe('Repo model "get" method', () => {
  beforeEach(connectDB)
  afterEach(dropDB)

  it('no filtering', async () => {
    const modelA = object({ id: number() })
    const repo = await initRepoHelper({ modelA })
    const collection = repo.modelA.mongo().collection

    const samples = [{ id: 1 }, { id: 2 }] satisfies Array<
      SubjectType<typeof modelA>
    >

    await collection.insertMany(samples.map(clone))

    const expected = samples
    const actual = await repo.modelA.get()

    expected.sort(sort)
    actual.sort(sort)

    expect(actual).toStrictEqual(expected)
  })

  it('two fields eq direct lookup', async () => {
    const modelA = object({ id: number(), a: string(), b: string() })
    const repo = await initRepoHelper({ modelA })
    const collection = repo.modelA.mongo().collection

    const samples = [
      { id: 1, a: '1-a', b: '1-b' },
      { id: 2, a: '2-a', b: '2-b' },
    ] satisfies Array<SubjectType<typeof modelA>>

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
        const modelA = object({ id: number() })
        const repo = await initRepoHelper({ modelA })
        const collection = repo.modelA.mongo().collection

        const samples = [{ id: 1 }, { id: 2 }] satisfies Array<
          SubjectType<typeof modelA>
        >

        await collection.insertMany(samples.map(clone))

        const expected = [samples[1]]
        const actual = await repo.modelA.get({ id: { $eq: 2 } })

        expect(actual).toStrictEqual(expected)
      })

      it('non existed value lookup', async () => {
        const modelA = object({ id: number() })
        const repo = await initRepoHelper({ modelA })
        const collection = repo.modelA.mongo().collection

        const samples = [{ id: 1 }, { id: 2 }] satisfies Array<
          SubjectType<typeof modelA>
        >

        await collection.insertMany(samples.map(clone))

        const expected = [] as typeof samples
        const actual = await repo.modelA.get({ id: { $eq: 3 } })

        expect(actual).toStrictEqual(expected)
      })

      it('undefined value lookup', async () => {
        const modelA = object({ id: number(), x: string().optional() })
        const repo = await initRepoHelper({ modelA })
        const collection = repo.modelA.mongo().collection

        const samples = [
          { id: 1 },
          { id: 2, x: 'A' },
          { id: 3 },
        ] satisfies Array<SubjectType<typeof modelA>>

        await collection.insertMany(samples.map(clone))

        const expected = [samples[0], samples[2]]
        const actual = await repo.modelA.get({ x: undefined })

        expect(actual).toStrictEqual(expected)
      })

      it('implicit $eq', async () => {
        const modelA = object({ id: number() })
        const repo = await initRepoHelper({ modelA })
        const collection = repo.modelA.mongo().collection

        const samples = [{ id: 1 }, { id: 2 }] satisfies Array<
          SubjectType<typeof modelA>
        >

        await collection.insertMany(samples.map(clone))

        const expected = [samples[1]]
        const actual = await repo.modelA.get({ id: 2 })

        expect(actual).toStrictEqual(expected)
      })

      it('multiple fields filter', async () => {
        const modelA = object({ id: number(), x: string() })
        const repo = await initRepoHelper({ modelA })
        const collection = repo.modelA.mongo().collection

        const samples = [
          { id: 1, x: 'a' },
          { id: 2, x: 'b' },
          { id: 3, x: 'b' },
        ] satisfies Array<SubjectType<typeof modelA>>

        await collection.insertMany(samples.map(clone))

        const expected = [samples[1]!]
        const actual = await repo.modelA.get({ id: 2, x: 'b' })

        expected.sort(sort)
        actual.sort(sort)

        expect(actual).toStrictEqual(expected)
      })
    })

    it('$in', async () => {
      const modelA = object({ id: number() })
      const repo = await initRepoHelper({ modelA })
      const collection = repo.modelA.mongo().collection

      const samples = [{ id: 1 }, { id: 2 }, { id: 3 }] satisfies Array<
        SubjectType<typeof modelA>
      >

      await collection.insertMany(samples.map(clone))

      const expected = [samples[0], samples[2]]
      const actual = await repo.modelA.get({ id: { $in: [1, 3] } })

      expect(actual).toStrictEqual(expected)
    })
  })

  describe('Logical operators', () => {
    it('$or', async () => {
      const modelA = object({ id: number(), x: boolean().optional() })
      const repo = await initRepoHelper({ modelA })
      const collection = repo.modelA.mongo().collection

      const samples = [
        { id: 1, x: true },
        { id: 2, x: false },
        { id: 3, x: undefined },
        { id: 4 },
      ] satisfies Array<SubjectType<typeof modelA>>

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
      const modelA = object({ id: number(), x: boolean().optional() })
      const repo = await initRepoHelper({ modelA })
      const collection = repo.modelA.mongo().collection

      const samples = [
        { id: 1, x: true },
        { id: 2, x: false },
        { id: 3, x: undefined },
        { id: 4 },
      ] satisfies Array<SubjectType<typeof modelA>>

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
      const modelA = object({ id: number(), x: boolean().optional() })
      const repo = await initRepoHelper({ modelA })
      const collection = repo.modelA.mongo().collection

      const samples = [
        { id: 1, x: true },
        { id: 2, x: false },
        { id: 3, x: undefined },
        { id: 4 },
      ] satisfies Array<SubjectType<typeof modelA>>

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
      const modelA = object({ id: number(), x: boolean().optional() })
      const repo = await initRepoHelper({ modelA })
      const collection = repo.modelA.mongo().collection

      const samples = [
        { id: 0, x: true },
        { id: 1, x: false },
        { id: 2 },
        { id: 3 },
      ] satisfies Array<SubjectType<typeof modelA>>

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
        const modelA = object({ id: number(), x: array(string()) })
        const repo = await initRepoHelper({ modelA })
        const collection = repo.modelA.mongo().collection

        const samples = [
          { id: 0, x: ['a', 'b'] },
          { id: 1, x: ['b', 'a'] },
        ] satisfies Array<SubjectType<typeof modelA>>

        await collection.insertMany(samples.map(clone))

        const expected = [samples[1]]
        const actual = await repo.modelA.get({
          x: { $eq: ['b', 'a'] },
        })

        expect(actual).toStrictEqual(expected)
      })

      it('$eq implicit', async () => {
        const modelA = object({ id: number(), x: array(string()) })
        const repo = await initRepoHelper({ modelA })
        const collection = repo.modelA.mongo().collection

        const samples = [
          { id: 0, x: ['a', 'b'] },
          { id: 1, x: ['b', 'a'] },
        ] satisfies Array<SubjectType<typeof modelA>>

        await collection.insertMany(samples.map(clone))

        const expected = [samples[1]]
        const actual = await repo.modelA.get({
          x: ['b', 'a'],
        })

        expect(actual).toStrictEqual(expected)
      })

      it('$in', async () => {
        const modelA = object({ id: number(), x: array(string()) })
        const repo = await initRepoHelper({ modelA })
        const collection = repo.modelA.mongo().collection

        const samples = [
          { id: 0, x: [] },
          { id: 1, x: ['a'] },
          { id: 2, x: ['a', 'b'] },
          { id: 3, x: ['b', 'a'] },
        ] satisfies Array<SubjectType<typeof modelA>>

        await collection.insertMany(samples.map(clone))

        const expected = [samples[0], samples[1], samples[3]]
        const actual = await repo.modelA.get({
          x: { $in: [[], ['a'], ['b', 'a']] },
        })

        expect(actual).toStrictEqual(expected)
      })

      it('$all', async () => {
        const modelA = object({ id: number(), x: array(string()) })
        const repo = await initRepoHelper({ modelA })
        const collection = repo.modelA.mongo().collection

        const samples = [
          { id: 0, x: [] },
          { id: 1, x: ['a'] },
          { id: 2, x: ['a', 'b'] },
          { id: 3, x: ['b', 'a'] },
          { id: 4, x: ['b'] },
        ] satisfies Array<SubjectType<typeof modelA>>

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
      const modelA = object({ id: number(), x: string().optional() })
      const repo = await initRepoHelper({ modelA })
      const collection = repo.modelA.mongo().collection

      const samples = [{ id: 0 }, { id: 1, x: 'A' }, { id: 2 }] satisfies Array<
        SubjectType<typeof modelA>
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
