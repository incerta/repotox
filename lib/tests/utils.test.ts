import * as x from 'schematox'
import { FOREIGN_KEY_BRAND_TYPE } from '../constants'
import { getCollectionForeignKeyRelations } from '../utils'

import type { FieldRelation } from '../types'

describe('FieldRelation definition', () => {
  describe('Unilateral', () => {
    it.todo('dependencyKind: primary-unilateral; cardinalityType: one')
    it.todo('dependencyKind: primary-unilateral; cardinalityType: many')
    it.todo('dependencyKind: secondary-unilateral; cardinalityType: one')
    it.todo('dependencyKind: secondary-unilateral; cardinalityType: many')
    it.todo('multi sourceCollectionName of schema union')
    it.todo('multi sourceCollectionName of string field union')
    it.todo('multi sourceCollectionName of string field union and schema union')
    it.todo('multi sourceCollectionName of string field array union')
    it.todo(
      'multi sourceCollectionName of string field array union and schema union'
    )
  })

  describe('Bilateral', () => {
    it.todo('dependencyKind: primary-to-secondary; cardinality: one-to-one')

    it('dependencyKind: primary-to-secondary; cardinality: one-to-many | many-to-one', () => {
      const modelAId = x.string().brand(FOREIGN_KEY_BRAND_TYPE, 'modelA')
      const modelBId = x.string().brand(FOREIGN_KEY_BRAND_TYPE, 'modelB')

      const modelA = x.object({
        id: modelAId,
        modelBIds: x.array(modelBId).optional(),
      })

      const modelB = x.object({
        id: modelBId,
        modelAId: modelAId,
      })

      const models = { modelA, modelB }

      const [actualModelARelation] = getCollectionForeignKeyRelations(
        models,
        'modelA'
      ).relations

      const expectedModelARelation: FieldRelation = {
        dependencyKind: 'primary-to-secondary',
        cardinalityType: 'many-to-one',

        sourceCollectionName: 'modelA',
        sourceCollectionFieldKey: 'modelBIds',

        targetCollectionName: 'modelB',
        targetCollectionFieldKey: 'modelAId',
      }

      expect(actualModelARelation).toStrictEqual(expectedModelARelation)

      const [actualModelBRelation] = getCollectionForeignKeyRelations(
        models,
        'modelB'
      ).relations

      const expectedModelBRelation: FieldRelation = {
        dependencyKind: 'secondary-to-primary',
        cardinalityType: 'one-to-many',

        sourceCollectionName: 'modelB',
        sourceCollectionFieldKey: 'modelAId',

        targetCollectionName: 'modelA',
        targetCollectionFieldKey: 'modelBIds',
      }

      expect(actualModelBRelation).toStrictEqual(expectedModelBRelation)
    })

    it.todo('dependencyKind: primary-to-secondary; cardinality: many-to-one')
    it.todo('dependencyKind: primary-to-secondary; cardinality: many-to-many')

    it.todo('dependencyKind: secondary-to-primary; cardinality: one-to-one')
    it.todo('dependencyKind: secondary-to-primary; cardinality: one-to-many')
    it.todo('dependencyKind: secondary-to-primary; cardinality: many-to-one')
    it.todo('dependencyKind: secondary-to-primary; cardinality: many-to-many')

    it.todo('dependencyKind: primary-to-primary; cardinality: one-to-one')
    it.todo('dependencyKind: primary-to-primary; cardinality: one-to-many')
    it.todo('dependencyKind: primary-to-primary; cardinality: many-to-one')
    it.todo('dependencyKind: primary-to-primary; cardinality: many-to-many')
  })
})
