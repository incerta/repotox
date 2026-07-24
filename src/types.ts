import type { Collection } from 'mongodb'
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
    | Exclude<PrimitiveSchema, { type: 'bigint' }>
    | UnionSchema<Array<LiteralSchema<string> | StringSchema>>
    | ArraySchema<
        | StringSchema
        | NumberSchema
        | UnionSchema<
            Array<StringSchema | LiteralSchema<string> | LiteralSchema<number>>
          >
      >
  >
>

export type UnionRepoModelSchema = UnionSchema<Array<BaseRepoModelSchema>>
export type RepoModelSchema = BaseRepoModelSchema | UnionRepoModelSchema

export type RepoStruct = {
  __schema: RepoModelSchema
  parse: (x: unknown) => ParseResult<unknown>
}

export type RepoModel<
  T extends RepoStruct = RepoStruct,
  U extends Record<string, unknown> = Infer<T>,
> = {
  collection: Collection<U>
  schema: T
}

export type InitRepo<T extends Record<string, RepoStruct>> = {
  [k in keyof T]: RepoModel<T[k]>
}
