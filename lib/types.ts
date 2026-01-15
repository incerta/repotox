import type { ClientSession, Collection } from 'mongodb'
import type {
  Infer,
  PrimitiveSchema,
  ObjectSchema,
  UnionSchema,
  StringSchema,
  NumberSchema,
  LiteralSchema,
  ArraySchema,
  ParseResult,
} from 'schematox'

export type BaseRepoModelSchema = ObjectSchema<
  Record<
    string,
    | PrimitiveSchema
    | UnionSchema<Array<LiteralSchema<string> | StringSchema>>
    | ArraySchema<
        | StringSchema
        | NumberSchema
        | UnionSchema<Array<StringSchema /* TODO: allow string literal */>>
      >
  >
>

export type UnionRepoModelSchema = UnionSchema<Array<BaseRepoModelSchema>>
export type RepoModelSchema = BaseRepoModelSchema | UnionRepoModelSchema

export type CommonDoc = {
  id: string
  createdAt?: number
  updatedAt?: number
  deletedAt?: number
  createdBy?: string
  updatedBy?: string
}

export type FieldRelationUnilateral = {
  dependencyKind:
    | 'primary-unilateral' // reference is optional
    | 'secondary-unilateral' // reference is required

  cardinalityType:
    | 'one' // source: string
    | 'many' // source: string[]

  sourceCollectionName:
    | string // field is branded foreign key string
    | string[] // field is union of branded foreign key strings

  sourceCollectionFieldKey: string
  targetCollectionName: string | string[]
}

export type FieldRelationBilateral = {
  dependencyKind:
    | 'primary-to-secondary' // source: optional -> target: required
    | 'secondary-to-primary' // source: required -> target: optional
    | 'primary-to-primary' // source: optional -> target: optional

  cardinalityType:
    | 'one-to-one' // source: string -> target: string
    | 'one-to-many' // source: string -> target: string[]
    | 'many-to-one' //  source: string[] -> target: string
    | 'many-to-many' // source: string[] -> target: string[]

  sourceCollectionName: string
  sourceCollectionFieldKey: string

  targetCollectionName: string
  targetCollectionFieldKey: string
}

export type FieldRelation = FieldRelationUnilateral | FieldRelationBilateral

export type RepoTox = {
  __schema: RepoModelSchema
  parse: (x: unknown) => ParseResult<unknown>
}

export type MutationReport = [brand: string, id: string]
export type SafeRemoveResult = {
  updated?: MutationReport[]
  removed: MutationReport[]
}

export type RepoModel<
  T extends RepoTox = RepoTox,
  U extends Record<string, unknown> = Infer<T>,
> = {
  tox: T
  relations: FieldRelation[]

  mongo: (
    session?: ClientSession,
    userId?: string
  ) => {
    collection: Collection<U>
    session?: ClientSession
    userId?: string
  }

  get: (filter?: MongoFilter<U>, session?: ClientSession) => Promise<U[]>

  /**
   * Create new record. Attempt to write on existing
   * record will throw error
   **/
  post: (input: U, session?: ClientSession, userId?: string) => Promise<U>

  /**
   * Update existed record. Attempt to update non existing
   * record will throw error. Data payload must be complete
   * representation of the record. All absent properties
   * will be set to `undefined` value.
   *
   * If model has `updatedAt` property it will be set automatically
   * The value of `input.updatedAt` will be ignored
   *
   * If model has `updatedBy` property and `userId` is provided
   * it will be set automatically ignoring `input.updatedBy`
   **/
  put: (input: U, session?: ClientSession, userId?: string) => Promise<U>

  /**
   * Delete one or many records by id
   **/
  remove: (
    idOrIds: U extends { id: infer V } ? V | V[] : never,
    session?: ClientSession,
    userId?: string
  ) => Promise<undefined>

  /**
   * @description [BETA] This method is currently in beta stage.
   */
  safeRemove: (
    id: U['id'],
    session?: ClientSession,
    userId?: string
  ) => Promise<{
    confirm: () => Promise<SafeRemoveResult>
    stagedForUpdate?: MutationReport[]
    stagedForRemove?: MutationReport[]
  }>
}

export type InitRepo<T extends Record<string, RepoTox>> = {
  [k in keyof T]: RepoModel<T[k]>
} & {
  _wrap: (session?: ClientSession, userId?: string) => InitRepo<T>
}

/* mongodb queries */

type StringQuery<T extends string | undefined | null> =
  | { $eq: T }
  | { $ne: T | undefined }
  | { $in: T[] }
  | { $exists: boolean }
  | { $regexp: RegExp }
  | { $not: RegExp }
  | {
      $text: {
        $search: string
        $language?: string
        $caseSensitive?: boolean
        $diacriticSensitive?: boolean
      }
    }

type BooleanQuery<T extends boolean | undefined | null> =
  | { $eq: T }
  | { $exists: boolean }

type NumberQuery<T extends number | undefined | null> =
  | { $eq: T }
  | { $in: T[] }
  | { $exists: boolean }
  | { $gt: number } // >
  | { $gte: number } // >=
  | { $lt: number } // <
  | { $lte: number } // <=
  | { $ne: number } // !==
  | { $mod: [divider: number, reminder: number] } // modulo operation

type ArrayQuery<T extends Array<string | number> | undefined | null> =
  | T
  | { $eq: T }
  | { $all: T }
  | { $in: T[] }
  | { $size: number }

type Logical<T> =
  | T
  | { $not: T | Logical<T> }
  | { $or: Array<T | Logical<T>> }
  | { $and: Array<T | Logical<T>> }
  | { $nor: Array<T | Logical<T>> }

type FieldLevel<T> = T extends number
  ? T | Logical<NumberQuery<T>>
  : T extends string
    ? T | Logical<StringQuery<T>>
    : T extends boolean
      ? T | Logical<BooleanQuery<T>>
      : T extends Array<string | number>
        ? T | Logical<ArrayQuery<T>>
        : T

export type MongoFilter<T> = Logical<
  Partial<{
    [K in keyof T]: FieldLevel<T[K]>
  }>
>

/**
 * TODO: support sorting
 *
 * Sorting
 *
 * | Field Type | Ascending Order (`1`) |
 * |------------|------------------------|
 * | String     | Alphabetically (A to Z);
 *               missing values first   |
 * | Number     | Numerically (smallest
 *               to largest); missing
 *               values first           |
 * | Boolean    | `false` then `true`;
 *               missing values first   |
 *
 * | Field Type | Descending Order (`-1`) |
 * |------------|--------------------------|
 * | String     | Alphabetically (Z to A);
 *               missing values last     |
 * | Number     | Numerically (largest
 *               to smallest); missing
 *               values last             |
 * | Boolean    | `true` then `false`;
 *               missing values last     |
 */
