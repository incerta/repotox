# Repotox

A lightweight schema-based ODM for MongoDB driver built on top of [Schematox](https://github.com/schematox/schematox) validation library schema types.

**Status**: Alpha version - API going to be changed

## Features

- **Schema-first approach**: Define your data models using Schematox schemas
- **Type safety**: Full TypeScript support with compile-time type checking
- **MongoDB native**: Built on top of MongoDB Node.js driver
- **Session support**: Built-in support for MongoDB transactions
- **Automatic timestamps**: Automatic `createdAt`, `updatedAt`, `createdBy`, `updatedBy` fields

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

const repo = await initRepo(client, 'myapp', {
  user: userSchema,
  post: postSchema,
})

// Use the repository
const user = await repo.user.post({
  id: 'user1',
  name: 'John Doe',
  email: 'john@example.com',
})

const post = await repo.post.post({
  id: 'post1',
  title: 'Hello World',
  content: 'My first post',
  userId: 'user1',
})
```

## Core Concepts

### Schema Definition

Repotox uses Schematox for schema validation. All models must have an `id` field:

```typescript
import * as x from 'schematox'

const userSchema = x.object({
  id: x.string(), // Required: every model must have an id field
  name: x.string(),
  age: x.number().optional(),
})
```

## Repository API

### Initialization

```typescript
const repo = await initRepo(mongoClient, databaseName, schemaModels)
```

### Model Methods

Each model in your repository gets the following methods:

#### `get(filter?, session?)`

Query records with MongoDB-style filters:

```typescript
// Get all users
const users = await repo.user.get()

// Get by ID
const user = await repo.user.get({ id: 'user1' })

// Complex queries
const adults = await repo.user.get({
  age: { $gte: 18 },
})

// Logical operators
const results = await repo.user.get({
  $or: [{ age: { $lt: 18 } }, { status: 'premium' }],
})
```

#### `post(data, session?, userId?)`

Create new records:

```typescript
const user = await repo.user.post({
  id: 'user1',
  name: 'John Doe',
  email: 'john@example.com',
})

// Automatic timestamps and user tracking
const userWithSession = await repo.user.post(userData, session, 'admin')
```

#### `put(data, session?, userId?)`

Update existing records:

```typescript
const updatedUser = await repo.user.put({
  id: 'user1',
  name: 'John Smith', // Updated name
  email: 'john.smith@example.com',
})
```

#### `remove(id | ids, session?)`

Remove records by ID:

```typescript
// Remove single record
await repo.user.remove('user1')

// Remove multiple records
await repo.user.remove(['user1', 'user2'])
```

#### `mongo(session?, userId?)`

Access the underlying MongoDB collection:

```typescript
const { collection, session, userId } = repo.user.mongo()
await collection.createIndex({ email: 1 }, { unique: true })
```

### Session Support

Repotox supports MongoDB sessions for transactions:

```typescript
const session = client.startSession()

try {
  await session.withTransaction(async () => {
    const user = await repo.user.post(userData, session)
    const profile = await repo.profile.post(profileData, session)
  })
} finally {
  await session.endSession()
}

// Or use the _wrap helper
const sessionRepo = repo._wrap(session, 'userId')
await sessionRepo.user.post(userData) // session is automatically passed
```

## Advanced Features

### Union Schemas

Repotox supports discriminated union schemas:

```typescript
const animalSchema = x.union([
  x.object({
    id: animalId,
    type: x.literal('dog'),
    breed: x.string(),
  }),
  x.object({
    id: animalId,
    type: x.literal('cat'),
    lives: x.number(),
  }),
])
```

## Error Handling

Repotox provides detailed error messages for common issues:

```typescript
import { ERROR } from 'repotox'

try {
  await repo.user.post(invalidData)
} catch (error) {
  if (error.message.includes('does not satisfy schema')) {
    // Handle validation error
  }
}
```

Common error types:

- Schema validation errors
- Duplicate ID errors

## Type Safety

Repotox provides full TypeScript support with inferred types:

```typescript
// Types are automatically inferred from schemas
type User = x.Infer<typeof userSchema>
type Post = x.Infer<typeof postSchema>

// Repository methods are fully typed
const user: User = await repo.user.get({ id: 'user1' })[0]
```

## Constants

```typescript
import {
  ERROR, // Error message generators
} from 'repotox'
```
