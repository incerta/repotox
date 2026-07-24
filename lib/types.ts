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
        | UnionSchema<Array<StringSchema /* TODO: allow string literal */>>
      >
  >
>

export type UnionRepoModelSchema = UnionSchema<Array<BaseRepoModelSchema>>
export type RepoModelSchema = BaseRepoModelSchema | UnionRepoModelSchema

export type RepoTox = {
  __schema: RepoModelSchema
  parse: (x: unknown) => ParseResult<unknown>
}

export type RepoModel<
  T extends RepoTox = RepoTox,
  U extends Record<string, unknown> = Infer<T>,
> = {
  collection: Collection<U>
  schema: T
}

export type InitRepo<T extends Record<string, RepoTox>> = {
  [k in keyof T]: RepoModel<T[k]>
}
