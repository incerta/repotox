# Repotox

A lightweight schema-based ORM for MongoDB driver built on top of [Schematox](https://github.com/schematox/schematox) validation library.

**Status**: Alpha version - API going to be changed

## Features

- **Schema-first approach**: Define your data models using Schematox schemas
- **Automatic relationship management**: Define foreign key relationships with brand types
- **Safe cascading operations**: Safe removal with dependency tracking
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
import { initRepo, FOREIGN_KEY_BRAND_TYPE } from 'repotox'
import { MongoClient } from 'mongodb'

// Define branded types for foreign keys
const userId = x.string().brand(FOREIGN_KEY_BRAND_TYPE, 'user')
const postId = x.string().brand(FOREIGN_KEY_BRAND_TYPE, 'post')

// Define your schemas
const userSchema = x.object({
  id: userId,
  name: x.string(),
  email: x.string(),
  postIds: x.array(postId).optional(), // One-to-many relationship
})

const postSchema = x.object({
  id: postId,
  title: x.string(),
  content: x.string(),
  userId: userId, // Many-to-one relationship
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

Repotox uses Schematox for schema validation. All models must have an `id` field with a branded type:

```typescript
import * as x from 'schematox'
import { FOREIGN_KEY_BRAND_TYPE } from 'repotox'

const userId = x.string().brand(FOREIGN_KEY_BRAND_TYPE, 'user')

const userSchema = x.object({
  id: userId, // Required: every model must have an id field
  name: x.string(),
  age: x.number().optional(),
})
```

### Relationship Types

Repotox supports various relationship patterns through foreign key branding:

#### One-to-One Relationships

```typescript
const userSchema = x.object({
  id: userId,
  profileId: profileId.optional(), // Optional = primary side
})

const profileSchema = x.object({
  id: profileId,
  userId: userId, // Required = secondary side
})
```

#### One-to-Many Relationships

```typescript
const userSchema = x.object({
  id: userId,
  postIds: x.array(postId).optional(), // Array = many side
})

const postSchema = x.object({
  id: postId,
  userId: userId, // Single reference = one side
})
```

#### Many-to-Many Relationships

```typescript
const userSchema = x.object({
  id: userId,
  roleIds: x.array(roleId).optional(),
})

const roleSchema = x.object({
  id: roleId,
  userIds: x.array(userId).optional(),
})
```

### Dependency Kinds

Relationships have dependency kinds that affect cascading behavior:

- **primary-to-secondary**: Primary side controls the relationship
- **secondary-to-primary**: Secondary side depends on primary
- **primary-to-primary**: Both sides are optional (weak relationship)
- **primary-unilateral**: One-way relationship, no back-reference
- **secondary-unilateral**: One-way relationship from dependent side

### Cardinality Types

- `one`: Single reference
- `many`: Array of references
- `one-to-one`: Bidirectional single references
- `one-to-many`: One side has array, other has single reference
- `many-to-one`: Inverse of one-to-many
- `many-to-many`: Both sides have arrays

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

#### `safeRemove(id, session?, userId?)`

Safely remove records with cascade handling:

```typescript
const result = await repo.user.safeRemove('user1')

// Review what will be affected
console.log('Will be removed:', result.stagedForRemove)
console.log('Will be updated:', result.stagedForUpdate)

// Confirm the operation
const finalResult = await result.confirm()
console.log('Removed:', finalResult.removed)
console.log('Updated:', finalResult.updated)
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

### Ignoring Relations

To create a foreign key field without enforcing the relationship:

```typescript
const postSchema = x.object({
  id: postId,
  authorId: userId.description(IGNORE_RELATION), // No relationship enforcement
})
```

### Custom Validation

All Schematox validation features are supported:

```typescript
const userSchema = x.object({
  id: userId,
  email: x.string().refine((email) => email.includes('@'), 'Invalid email'),
  age: x.number().min(0).max(120),
})
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
- Missing required relationships
- Duplicate ID errors
- Invalid foreign key references
- Forbidden relationship configurations

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
  FOREIGN_KEY_BRAND_TYPE, // 'idFor' - for branding foreign keys
  IGNORE_RELATION, // 'ignore-relation' - disable relationship enforcement
  ERROR, // Error message generators
} from 'repotox'
```
