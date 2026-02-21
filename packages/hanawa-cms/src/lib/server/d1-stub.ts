/**
 * Lightweight in-memory D1 stub for contract tests.
 *
 * Documents D1's behavioral contracts without native dependencies:
 * - .first() returns null (not undefined) when no row matches
 * - .all() returns { results: T[], success: true, meta: D1Meta }
 * - .run() returns { success: true, meta: D1Meta, results: [] }
 * - .bind() is chainable, captures positional params
 *
 * The stub does basic SQL interpretation via regex (table + WHERE column = ?)
 * to look up rows in an in-memory store. It is NOT a SQL engine — it exists
 * to verify D1's API envelope, not SQL correctness.
 */

type Row = Record<string, unknown>;
type TableStore = Map<string, Row[]>;

// D1Meta with index signature to satisfy D1Response's `D1Meta & Record<string, unknown>`
type D1Meta = {
  duration: number;
  rows_read: number;
  rows_written: number;
  last_row_id: number;
  changed_db: boolean;
  changes: number;
  size_after: number;
  [key: string]: unknown;
};

function makeMeta(overrides: Partial<D1Meta> = {}): D1Meta {
  return {
    duration: 0,
    rows_read: 0,
    rows_written: 0,
    last_row_id: 0,
    changed_db: false,
    changes: 0,
    size_after: 0,
    ...overrides,
  };
}

/** Parse basic SQL to extract operation, table, and WHERE conditions */
function parseSQL(sql: string): {
  op: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  whereColumns: string[];
  orNullColumns: Set<string>;
  setClauses: string[];
  insertColumns: string[];
  hasOrderBy: boolean;
  hasLimit: boolean;
  limitValue: number | null;
} {
  const normalized = sql.replace(/\s+/g, ' ').trim();

  let op: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' = 'SELECT';
  if (normalized.toUpperCase().startsWith('INSERT')) op = 'INSERT';
  else if (normalized.toUpperCase().startsWith('UPDATE')) op = 'UPDATE';
  else if (normalized.toUpperCase().startsWith('DELETE')) op = 'DELETE';

  // Extract table name
  let table = '';
  if (op === 'SELECT') {
    const m = normalized.match(/FROM\s+(\w+)/i);
    table = m?.[1] ?? '';
  } else if (op === 'INSERT') {
    const m = normalized.match(/INTO\s+(\w+)/i);
    table = m?.[1] ?? '';
  } else if (op === 'UPDATE') {
    const m = normalized.match(/UPDATE\s+(\w+)/i);
    table = m?.[1] ?? '';
  } else if (op === 'DELETE') {
    const m = normalized.match(/FROM\s+(\w+)/i);
    table = m?.[1] ?? '';
  }

  // Detect (column = ? OR column IS NULL) patterns — used by siteOrGlobalAll
  const orNullColumns = new Set<string>();
  const orNullRegex = /\((\w+)\s*=\s*\?\s+OR\s+\1\s+IS\s+NULL\)/gi;
  let onm;
  while ((onm = orNullRegex.exec(normalized)) !== null) {
    orNullColumns.add(onm[1]!);
  }

  // Extract WHERE column = ? conditions (excluding those in OR NULL patterns)
  const whereColumns: string[] = [];
  const whereRegex = /(\w+)\s*=\s*\?/g;
  const whereClause = normalized.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s*$)/i);
  if (whereClause?.[1]) {
    let wm;
    while ((wm = whereRegex.exec(whereClause[1])) !== null) {
      if (!orNullColumns.has(wm[1]!)) {
        whereColumns.push(wm[1]!);
      }
    }
  }

  // Extract SET clauses for UPDATE
  const setClauses: string[] = [];
  if (op === 'UPDATE') {
    const setMatch = normalized.match(/SET\s+(.+?)\s+WHERE/i);
    if (setMatch?.[1]) {
      const setRegex = /(\w+)\s*=\s*\?/g;
      let sm;
      while ((sm = setRegex.exec(setMatch[1])) !== null) {
        setClauses.push(sm[1]!);
      }
    }
  }

  // Extract INSERT columns
  const insertColumns: string[] = [];
  if (op === 'INSERT') {
    const colMatch = normalized.match(/\(([^)]+)\)\s*VALUES/i);
    if (colMatch?.[1]) {
      insertColumns.push(...colMatch[1].split(',').map((c) => c.trim()));
    }
  }

  const hasOrderBy = /ORDER\s+BY/i.test(normalized);
  const hasLimit = /LIMIT\s+/i.test(normalized);
  let limitValue: number | null = null;
  if (hasLimit) {
    const lm = normalized.match(/LIMIT\s+(\?|\d+)/i);
    if (lm?.[1] && lm[1] !== '?') limitValue = parseInt(lm[1], 10);
  }

  return {
    op,
    table,
    whereColumns,
    orNullColumns,
    setClauses,
    insertColumns,
    hasOrderBy,
    hasLimit,
    limitValue,
  };
}

class StubPreparedStatement {
  private sql: string;
  private params: unknown[] = [];
  private store: TableStore;

  constructor(sql: string, store: TableStore) {
    this.sql = sql;
    this.store = store;
  }

  bind(...values: unknown[]): StubPreparedStatement {
    this.params = values;
    return this;
  }

  async first<T = Row>(): Promise<T | null> {
    const { op, table, whereColumns, orNullColumns } = parseSQL(this.sql);
    if (op !== 'SELECT') throw new Error('first() only valid for SELECT');

    const rows = this.store.get(table) ?? [];
    const match = this.findMatch(rows, whereColumns, orNullColumns);
    // D1 contract: .first() returns null (not undefined) when no row matches
    return (match as T) ?? null;
  }

  async all<T = Row>(): Promise<{ results: T[]; success: true; meta: D1Meta }> {
    const { op, table, whereColumns, orNullColumns, hasLimit, limitValue } = parseSQL(this.sql);
    if (op !== 'SELECT') throw new Error('all() only valid for SELECT');

    const rows = this.store.get(table) ?? [];
    let results = this.findAllMatches(rows, whereColumns, orNullColumns);

    // Handle LIMIT with ? param
    if (hasLimit && limitValue === null) {
      // LIMIT is a ? param — find which param index it is
      const limitIdx = whereColumns.length;
      const limit = this.params[limitIdx];
      if (typeof limit === 'number') {
        results = results.slice(0, limit);
      }
    } else if (hasLimit && limitValue !== null) {
      results = results.slice(0, limitValue);
    }

    // D1 contract: .all() returns { results, success: true, meta }
    return {
      results: results as T[],
      success: true,
      meta: makeMeta({ rows_read: results.length }),
    };
  }

  async run(): Promise<{ success: true; meta: D1Meta; results: [] }> {
    const { op, table, whereColumns, orNullColumns, setClauses, insertColumns } = parseSQL(
      this.sql
    );

    if (op === 'INSERT') {
      const row: Row = {};
      for (let i = 0; i < insertColumns.length; i++) {
        row[insertColumns[i]!] = this.params[i] ?? null;
      }
      // Add timestamps D1 would auto-set if using DEFAULT
      if (!row['created_at']) row['created_at'] = new Date().toISOString();
      if (!row['updated_at']) row['updated_at'] = new Date().toISOString();

      const existing = this.store.get(table) ?? [];
      existing.push(row);
      this.store.set(table, existing);
    } else if (op === 'UPDATE') {
      const rows = this.store.get(table) ?? [];
      // SET params come first, then WHERE params
      const setValues = this.params.slice(0, setClauses.length);
      const whereValues = this.params.slice(setClauses.length);

      for (const row of rows) {
        if (this.matchesWhere(row, whereColumns, orNullColumns, whereValues)) {
          for (let i = 0; i < setClauses.length; i++) {
            row[setClauses[i]!] = setValues[i];
          }
          row['updated_at'] = new Date().toISOString();
        }
      }
    } else if (op === 'DELETE') {
      const rows = this.store.get(table) ?? [];
      const remaining = rows.filter(
        (row) => !this.matchesWhere(row, whereColumns, orNullColumns, this.params)
      );
      this.store.set(table, remaining);
    }

    // D1 contract: .run() returns { success: true, meta, results: [] }
    return {
      success: true,
      meta: makeMeta({ changed_db: true, changes: 1, rows_written: 1 }),
      results: [],
    };
  }

  private findMatch(rows: Row[], whereColumns: string[], orNullColumns: Set<string>): Row | null {
    if (whereColumns.length === 0 && orNullColumns.size === 0) return rows[0] ?? null;
    for (const row of rows) {
      if (this.matchesWhere(row, whereColumns, orNullColumns, this.params)) {
        return row;
      }
    }
    return null;
  }

  private findAllMatches(rows: Row[], whereColumns: string[], orNullColumns: Set<string>): Row[] {
    if (whereColumns.length === 0 && orNullColumns.size === 0) return [...rows];
    return rows.filter((row) => this.matchesWhere(row, whereColumns, orNullColumns, this.params));
  }

  private matchesWhere(
    row: Row,
    whereColumns: string[],
    orNullColumns: Set<string>,
    params: unknown[]
  ): boolean {
    // Check exact-match WHERE conditions
    for (let i = 0; i < whereColumns.length; i++) {
      const col = whereColumns[i]!;
      const paramVal = params[i];
      if (row[col] !== paramVal) return false;
    }
    // Check (column = ? OR column IS NULL) conditions
    // The param for these comes after the regular WHERE params
    let orNullIdx = whereColumns.length;
    for (const col of orNullColumns) {
      const paramVal = params[orNullIdx];
      if (row[col] !== paramVal && row[col] !== null && row[col] !== undefined) return false;
      orNullIdx++;
    }
    return true;
  }
}

/**
 * Create an in-memory D1Database stub.
 * Implements the subset of D1Database used by db.ts.
 */
export function createD1Stub(): D1Database {
  const store: TableStore = new Map();

  const db = {
    prepare(sql: string) {
      return new StubPreparedStatement(sql, store) as unknown as D1PreparedStatement;
    },
    // Batch is not used by db.ts but required by the D1Database interface
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const results: D1Result<T>[] = [];
      for (const stmt of statements) {
        const result = await (stmt as unknown as StubPreparedStatement).all<T>();
        results.push(result as D1Result<T>);
      }
      return results;
    },
    async dump(): Promise<ArrayBuffer> {
      return new ArrayBuffer(0);
    },
    async exec(_sql: string): Promise<D1ExecResult> {
      return { count: 0, duration: 0 };
    },
    withSession() {
      // Sessions are a D1 consistency primitive — not relevant for in-memory stub
      return db;
    },
  };

  return db as unknown as D1Database;
}
