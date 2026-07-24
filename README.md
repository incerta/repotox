# Repotox

Maps [Schematox](https://github.com/schematox/schematox) schemas to typed MongoDB collections.

**Status**: Alpha version - API going to be changed

## Installation

```bash
npm install repotox
```

peer dependencies:

```bash
npm install schematox mongodb
```

## Quick Start

```typescript
import * as x from 'schematox'
import { initRepo } from 'repotox'
import { MongoClient } from 'mongodb'

// Define your schemas
const userSchema = x.object({
  id: x.string(),
  name: x.string(),
  email: x.string(),
})

const postSchema = x.object({
  id: x.string(),
  title: x.string(),
  content: x.string(),
  userId: x.string(),
})

// Initialize repository
const client = new MongoClient('mongodb://localhost:27017')
await client.connect()

const repo = initRepo(client, 'myapp', {
  user: userSchema,
  post: postSchema,
})

// repo.user.collection is a typed `mongodb` Collection<Infer<typeof userSchema>>
await repo.user.collection.insertOne({
  id: 'user1',
  name: 'John Doe',
  email: 'john@example.com',
})

// repo.user.schema is the exact schema instance passed in
const parsed = repo.user.schema.parse({ id: 'user1', name: 'John Doe' })
```

## API

```typescript
const repo = initRepo(mongoClient, databaseName, schemaModels)
```

For each key in `schemaModels`, `repo` exposes:

- `collection`: the underlying [`mongodb`](https://www.mongodb.com/docs/drivers/node/current/) `Collection`, named after the key, scoped to `databaseName`. Use it directly for reads, writes, indexes, and transactions — repotox does not wrap the driver's API.
- `schema`: the exact Schematox schema instance passed in for that key, so `schema.parse(...)` and `Infer<typeof schema>` work as usual.

## Union Schemas

Discriminated union schemas are supported:

```typescript
const animalSchema = x.union([
  x.object({
    id: x.string(),
    type: x.literal('dog'),
    breed: x.string(),
  }),
  x.object({
    id: x.string(),
    type: x.literal('cat'),
    lives: x.number(),
  }),
])
```

## Type Safety

```typescript
import type { Infer } from 'schematox'

type User = Infer<typeof userSchema>

const users = await repo.user.collection.find({}).toArray()
```
