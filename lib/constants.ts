export const ALWAYS_UNIQUE_KEY = 'id'
// FIXME: rename to `UNILATERAL_RELATION`
export const IGNORE_RELATION = 'ignore-relation'
export const FOREIGN_KEY_BRAND_TYPE = 'idFor'
export const USED_UUID_SYSTEM_COLLECTION = '__uuid'

export const ERROR = {
  /* Record operation errors */

  noIdField: (brand: string) => `Model "${brand}" must have "id" field`,
  recordAlreadyExists: (brand: string, id: string | number) =>
    `Attempt to create existed record "${brand}: ${id}"`,
  recordNotExists: (brand: string, id: string | number) =>
    `Attempt to update non existed record "${brand}: ${id}"`,
  doesNotSatisfySchema: (brand: string, id: string | number) =>
    `Input "${brand}: ${id}" does not satisfy schema constraint`,
  idIsAlreadyTaken: (id: string | number) => `Id is already taken ${id}`,

  /* Schema definition errors */

  unsupportedSchemaType: (brand: string, type: string) =>
    `Unsupported "${brand}" type: ${type}`,
  singularUnionSchemaMember: (brand: string) =>
    `Repo model "${brand}" union object schema with only one or no members is not allowed`,
  invalidPropertyType: (brand: string, key: string, type: string) =>
    `Unsupported property type "${type}" of "${brand}: ${key}"`,
  invalidLiteralPropertyType: (brand: string, key: string) =>
    `Only "string" literal type is supported "${brand}: ${key}"`,
  invalidArrayPropertyType: (brand: string, key: string, type: string) =>
    `Invalid array property type "${type}" of "${brand}: ${key}"}`,
  invalidArrayPropertyUnionMemberType: (
    brand: string,
    key: string,
    type: string
  ) => `Invalid array union schema type "${type}" of "${brand}: ${key}"}`,
  invalidUnionSchemaMemberType: (brand: string) =>
    `Repo model "${brand}" union schema variant must have "object" type`,
  invalidUnionSchemaMemberPropertyType: (brand: string, key: string) =>
    `Two different types under same key in discriminated union variants is not allowed "${brand}: ${key}"`,

  /* Schema relation errors */

  noUserDefinedRelation: (
    targetBrand: string,
    sourceBrand: string,
    sourceKey: string
  ) =>
    `Model "${targetBrand}" has no user-defined relation, must be either "${sourceBrand}Id" for one-to-one or "${sourceBrand}Ids" for one-to-many relation. \nMark "${sourceBrand}: ${sourceKey}" with ".description('${IGNORE_RELATION}')" in order to avoid this relation enforcement`,

  referenceToNonExistedRecord: (sourceBrand: string, sourceKey: string) =>
    `MutationError: reference to non existed record "${sourceBrand} -> ${sourceKey}"`,
  secondaryToSecondaryRelationIsForbidden: (
    sourceBrand: string,
    sourceKey: string
  ) =>
    `Secondary to secondary dependency relation is forbidden "${sourceBrand} -> ${sourceKey}"`,
}
