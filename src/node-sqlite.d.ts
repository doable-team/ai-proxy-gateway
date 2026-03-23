declare module 'node:sqlite' {
  interface StatementResultingChanges {
    changes: number
    lastInsertRowid: number | bigint
  }

  interface StatementSync {
    run(...params: unknown[]): StatementResultingChanges
    get(...params: unknown[]): Record<string, unknown> | undefined
    all(...params: unknown[]): Record<string, unknown>[]
  }

  class DatabaseSync {
    constructor(path: string, options?: { open?: boolean; readOnly?: boolean })
    exec(sql: string): void
    prepare(sql: string): StatementSync
    close(): void
  }
}
