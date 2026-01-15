import { ERROR, FOREIGN_KEY_BRAND_TYPE, IGNORE_RELATION } from './constants'

import type { ClientSession } from 'mongodb'
import type { RepoModel, RepoTox, InitRepo, FieldRelation } from './types'

export function getCollectionForeignKeyRelations(
  modelToxByCollectionName: Record<string, RepoTox>,
  collectionName: string
) {
  const tox = modelToxByCollectionName[collectionName] as RepoTox

  if (tox.__schema.type === 'object') {
    if (tox.__schema.of.id === undefined) {
      throw new Error(ERROR.noIdField(collectionName))
    }

    // TODO: handle "invalidModelIdBrand" repo error
  } else {
    for (const sub of tox.__schema.of) {
      if (sub.of.id === undefined) {
        throw new Error(ERROR.noIdField(collectionName))
      }

      // TODO: handle "invalidModelIdBrand" repo error
    }
  }

  const schemaUnion =
    tox.__schema.type === 'union' ? tox.__schema.of : [tox.__schema]

  const schemaKeys = new Set<string>()

  const relations: FieldRelation[] = []

  for (const { of: schemaOf } of schemaUnion) {
    for (const sourceFieldKey in schemaOf) {
      if (sourceFieldKey === 'id') {
        continue
      }

      schemaKeys.add(sourceFieldKey)

      const propertySchema = schemaOf[sourceFieldKey as keyof typeof schemaOf]

      /* Detection of user-defined relations */

      if (typeof propertySchema !== 'object') {
        continue
      }

      const brandsPool: string[] = []

      const extractForeignKeyBrand = (schema: {
        brand?: readonly [string, unknown]
        type: string
      }): string | undefined => {
        if ('brand' in schema && schema.brand) {
          const [brandType, brand] = schema.brand

          if (brandType === FOREIGN_KEY_BRAND_TYPE) {
            if (schema.type !== 'string') {
              // TODO: add unit test and proper "ERROR" message
              throw new Error(
                `invalidForeignKeyBrandTypeUsage of :${collectionName}: ${sourceFieldKey}`
              )
            }

            if (typeof brand !== 'string') {
              throw Error('Brand second tuple member is expected to be string')
            }

            return brand
          }
        }

        return undefined
      }

      const targetToOneKey = `${collectionName}Id`
      const targetToManyKey = `${collectionName}Ids`
      const sourceKeyOptional = propertySchema.optional === true

      switch (propertySchema.type) {
        case 'boolean':
        case 'literal':
        case 'number':
        case 'string': {
          const targetCollectionName = extractForeignKeyBrand(propertySchema)

          if (targetCollectionName === undefined) {
            break
          }

          brandsPool.push(targetCollectionName)

          const targetSchema =
            modelToxByCollectionName[targetCollectionName]?.__schema

          if (targetSchema?.type !== 'object') {
            // FIXME: support unions at target schema
            break
          }

          if (
            targetToOneKey in targetSchema.of === false &&
            targetToManyKey in targetSchema.of === false
          ) {
            // unilateral case
            //

            relations.push({
              dependencyKind: sourceKeyOptional
                ? 'primary-unilateral'
                : 'secondary-unilateral',
              cardinalityType: 'one',
              sourceCollectionName: collectionName,
              sourceCollectionFieldKey: sourceFieldKey,
              targetCollectionName: targetCollectionName,
            })
            break
          }

          // bilateral case
          //

          if (targetToOneKey in targetSchema.of) {
            const targetPropertySchema = targetSchema.of[targetToOneKey]
            const targetKeyOptional = targetPropertySchema?.optional === true

            if (sourceKeyOptional && targetKeyOptional) {
              relations.push({
                dependencyKind: 'primary-to-primary',
                cardinalityType: 'one-to-one',
                sourceCollectionName: collectionName,
                sourceCollectionFieldKey: sourceFieldKey,
                targetCollectionName: targetCollectionName,
                targetCollectionFieldKey: targetToOneKey,
              })
            } else if (sourceKeyOptional && targetKeyOptional === false) {
              relations.push({
                dependencyKind: 'primary-to-secondary',
                cardinalityType: 'one-to-one',
                sourceCollectionName: collectionName,
                sourceCollectionFieldKey: sourceFieldKey,
                targetCollectionName: targetCollectionName,
                targetCollectionFieldKey: targetToOneKey,
              })
            } else if (sourceKeyOptional === false && targetKeyOptional) {
              relations.push({
                dependencyKind: 'secondary-to-primary',
                cardinalityType: 'one-to-one',
                sourceCollectionName: collectionName,
                sourceCollectionFieldKey: sourceFieldKey,
                targetCollectionName: targetCollectionName,
                targetCollectionFieldKey: targetToOneKey,
              })
            } else {
              throw Error(
                ERROR.secondaryToSecondaryRelationIsForbidden(
                  collectionName,
                  sourceFieldKey
                )
              )
            }

            break
          }

          if (targetToManyKey in targetSchema.of) {
            const targetPropertySchema = targetSchema.of[targetToManyKey]
            const targetKeyOptional = targetPropertySchema?.optional === true

            if (sourceKeyOptional && targetKeyOptional) {
              relations.push({
                dependencyKind: 'primary-to-primary',
                cardinalityType: 'one-to-many',
                sourceCollectionName: collectionName,
                sourceCollectionFieldKey: sourceFieldKey,
                targetCollectionName: targetCollectionName,
                targetCollectionFieldKey: targetToManyKey,
              })
            } else if (sourceKeyOptional && targetKeyOptional === false) {
              relations.push({
                dependencyKind: 'primary-to-secondary',
                cardinalityType: 'one-to-many',
                sourceCollectionName: collectionName,
                sourceCollectionFieldKey: sourceFieldKey,
                targetCollectionName: targetCollectionName,
                targetCollectionFieldKey: targetToManyKey,
              })
            } else if (sourceKeyOptional === false && targetKeyOptional) {
              relations.push({
                dependencyKind: 'secondary-to-primary',
                cardinalityType: 'one-to-many',
                sourceCollectionName: collectionName,
                sourceCollectionFieldKey: sourceFieldKey,
                targetCollectionName: targetCollectionName,
                targetCollectionFieldKey: targetToManyKey,
              })
            } else {
              throw Error(
                ERROR.secondaryToSecondaryRelationIsForbidden(
                  collectionName,
                  sourceFieldKey
                )
              )
            }

            break
          }

          break
        }

        case 'array': {
          if (propertySchema.of.type === 'union') {
            for (const arrUnionPropSchema of propertySchema.of.of) {
              const relatedBrand = extractForeignKeyBrand(arrUnionPropSchema)

              if (relatedBrand) {
                brandsPool.push(relatedBrand)
              }
            }

            break
          }

          const targetCollectionName = extractForeignKeyBrand(propertySchema.of)

          if (targetCollectionName === undefined) {
            break
          }

          brandsPool.push(targetCollectionName)

          const targetSchema =
            modelToxByCollectionName[targetCollectionName]?.__schema

          if (targetSchema?.type !== 'object') {
            // FIXME: support unions at target schema
            break
          }

          if (
            targetToOneKey in targetSchema.of === false &&
            targetToManyKey in targetSchema.of === false
          ) {
            // unilateral case
            //

            relations.push({
              dependencyKind: sourceKeyOptional
                ? 'primary-unilateral'
                : 'secondary-unilateral',
              cardinalityType: 'many',
              sourceCollectionName: collectionName,
              sourceCollectionFieldKey: sourceFieldKey,
              targetCollectionName: targetCollectionName,
            })
            break
          }

          // bilateral case
          //

          if (targetToOneKey in targetSchema.of) {
            const targetPropertySchema = targetSchema.of[targetToOneKey]
            const targetKeyOptional = targetPropertySchema?.optional === true

            if (sourceKeyOptional && targetKeyOptional) {
              relations.push({
                dependencyKind: 'primary-to-primary',
                cardinalityType: 'many-to-one',
                sourceCollectionName: collectionName,
                sourceCollectionFieldKey: sourceFieldKey,
                targetCollectionName: targetCollectionName,
                targetCollectionFieldKey: targetToOneKey,
              })
            } else if (sourceKeyOptional && targetKeyOptional === false) {
              relations.push({
                dependencyKind: 'primary-to-secondary',
                cardinalityType: 'many-to-one',
                sourceCollectionName: collectionName,
                sourceCollectionFieldKey: sourceFieldKey,
                targetCollectionName: targetCollectionName,
                targetCollectionFieldKey: targetToOneKey,
              })
            } else if (sourceKeyOptional === false && targetKeyOptional) {
              relations.push({
                dependencyKind: 'secondary-to-primary',
                cardinalityType: 'many-to-one',
                sourceCollectionName: collectionName,
                sourceCollectionFieldKey: sourceFieldKey,
                targetCollectionName: targetCollectionName,
                targetCollectionFieldKey: targetToOneKey,
              })
            } else {
              throw Error(
                ERROR.secondaryToSecondaryRelationIsForbidden(
                  collectionName,
                  sourceFieldKey
                )
              )
            }

            break
          }

          if (targetToManyKey in targetSchema.of) {
            const targetPropertySchema = targetSchema.of[targetToManyKey]
            const targetKeyOptional = targetPropertySchema?.optional === true

            if (sourceKeyOptional && targetKeyOptional) {
              relations.push({
                dependencyKind: 'primary-to-primary',
                cardinalityType: 'many-to-many',
                sourceCollectionName: collectionName,
                sourceCollectionFieldKey: sourceFieldKey,
                targetCollectionName: targetCollectionName,
                targetCollectionFieldKey: targetToManyKey,
              })
            } else if (sourceKeyOptional && targetKeyOptional === false) {
              relations.push({
                dependencyKind: 'primary-to-secondary',
                cardinalityType: 'many-to-many',
                sourceCollectionName: collectionName,
                sourceCollectionFieldKey: sourceFieldKey,
                targetCollectionName: targetCollectionName,
                targetCollectionFieldKey: targetToManyKey,
              })
            } else if (sourceKeyOptional === false && targetKeyOptional) {
              relations.push({
                dependencyKind: 'secondary-to-primary',
                cardinalityType: 'many-to-many',
                sourceCollectionName: collectionName,
                sourceCollectionFieldKey: sourceFieldKey,
                targetCollectionName: targetCollectionName,
                targetCollectionFieldKey: targetToManyKey,
              })
            } else {
              throw Error(
                ERROR.secondaryToSecondaryRelationIsForbidden(
                  collectionName,
                  sourceFieldKey
                )
              )
            }

            break
          }

          break
        }

        case 'union': {
          for (const member of propertySchema.of) {
            const relatedBrand = extractForeignKeyBrand(member)

            if (relatedBrand) {
              relations.push({
                dependencyKind: sourceKeyOptional
                  ? 'primary-unilateral'
                  : 'secondary-unilateral',
                cardinalityType: 'one',
                sourceCollectionName: collectionName,
                sourceCollectionFieldKey: sourceFieldKey,
                targetCollectionName: relatedBrand,
              })

              brandsPool.push(relatedBrand)
            }
          }
          break
        }

        default: {
          const x: never = propertySchema
          // @ts-expect-error exhausted
          const type = x?.type
          throw new Error(
            ERROR.invalidPropertyType(collectionName, sourceFieldKey, type)
          )
        }
      }

      for (const brand of brandsPool) {
        if (sourceFieldKey === 'id') {
          if (collectionName !== brand) {
            // TODO: add unit test and proper "ERROR" message
            throw new Error('invalidIdBrand')
          }

          continue
        }

        const relatedModelTox = modelToxByCollectionName[brand]

        if (relatedModelTox === undefined) {
          // TODO: add unit test and proper "ERROR" message
          throw new Error(
            `invalidBrandReferenceNoSuchModel of "${collectionName}: ${sourceFieldKey}"`
          )
        }

        if (propertySchema.description === IGNORE_RELATION) {
          continue
        }

        if (brand === collectionName) {
          // TODO: add unit test and proper "ERROR" message
          throw new Error(
            `forbiddenRecursiveRelation of "${collectionName}: ${sourceFieldKey}"`
          )
        }

        const relatedSchemaUnion =
          relatedModelTox.__schema.type === 'union'
            ? relatedModelTox.__schema.of.map((x) => x.of)
            : [relatedModelTox.__schema.of]

        const oneToOneKey = `${collectionName}Id`
        const oneToManyKey = `${collectionName}Ids`

        for (const relatedSchemaOf of relatedSchemaUnion) {
          if (
            oneToOneKey in relatedSchemaOf === false &&
            oneToManyKey in relatedSchemaOf === false
          ) {
            throw new Error(
              ERROR.noUserDefinedRelation(brand, collectionName, sourceFieldKey)
            )
          }
        }
      }
    }
  }

  return {
    tox,
    schemaKeys,
    relations,
  }
}

/**
 * Stub each repo model method with predefined `session` and `userId`
 **/
export function getModifiedRepo<T extends InitRepo<Record<string, RepoTox>>>(
  repo: T,
  session?: ClientSession,
  userId?: string
): T {
  const result = {} as T

  for (const key in repo) {
    const model = repo[key as keyof typeof repo] as RepoModel
    const updatedModel: Record<keyof typeof model, unknown> = {
      tox: model.tox,
      relations: model.relations,

      mongo: (_session?: ClientSession, _userId?: string) =>
        model.mongo(_session || session, _userId || userId),

      get: (filter: never, _session?: ClientSession) =>
        model.get(filter, _session || session),

      post: (value: never, _session?: ClientSession, _userId?: string) =>
        model.post(value, _session || session, _userId || userId),

      put: (value: never, _session?: ClientSession, _userId?: string) =>
        model.put(value, _session || session, _userId || userId),

      remove: (value: never, _session?: ClientSession, _userId?: string) =>
        model.remove(value, _session || session, _userId || userId),

      safeRemove: (value: never, _session?: ClientSession, _userId?: string) =>
        model.safeRemove(value, _session || session, _userId || userId),
    }

    // @ts-expect-error can't proof `key` <-> `updatedModel` relation
    result[key] = updatedModel
  }

  return result
}

export function sanitizeMongoRecord(x: Record<string, unknown>) {
  delete x._id
  delete x.__v

  for (const key in x) {
    if (x[key] === null) {
      delete x[key]
    }
  }
}
