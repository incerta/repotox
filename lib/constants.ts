export const ALWAYS_UNIQUE_KEY = 'id'
export const USED_UUID_SYSTEM_COLLECTION = '__uuid'

export const ERROR = {
  /* Record operation errors */

  noIdField: (brand: string) => `Model "${brand}" must have "id" field`,
  recordAlreadyExists: (brand: string, id: string | number) =>
    `Attempt to create existed record "${brand}: ${id}"`,
  recordNotExists: (brand: string, id: string | number) =>
    `Attempt to update non existed record "${brand}: ${id}"`,
  idIsAlreadyTaken: (id: string | number) => `Id is already taken ${id}`,
}
