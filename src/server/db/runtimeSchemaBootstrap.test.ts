import { describe, expect, it } from 'vitest';
import {
  __runtimeSchemaBootstrapTestUtils,
  ensureRuntimeDatabaseSchema,
  type RuntimeSchemaClient,
  type RuntimeSchemaDialect,
} from './runtimeSchemaBootstrap.js';

function createStubClient(dialect: RuntimeSchemaDialect, executedSql: string[]): RuntimeSchemaClient {
  return {
    dialect,
    begin: async () => {},
    commit: async () => {},
    rollback: async () => {},
    execute: async (sqlText: string) => {
      executedSql.push(sqlText);
      return [];
    },
    queryScalar: async (sqlText: string, params: unknown[] = []) => {
      if (sqlText.includes('information_schema') || sqlText.includes('sqlite_master') || sqlText.includes('pragma_table_info')) {
        return 1;
      }
      if (params.length > 0) {
        return 1;
      }
      return 0;
    },
    close: async () => {},
  };
}

describe('runtime schema bootstrap', () => {
  it.each(['mysql', 'postgres'] as const)('loads generated bootstrap statements for %s', async (dialect) => {
    const executedSql: string[] = [];
    const expectedBootstrapSql = __runtimeSchemaBootstrapTestUtils.readGeneratedBootstrapStatements(dialect);

    await ensureRuntimeDatabaseSchema(createStubClient(dialect, executedSql));

    expect(executedSql.slice(0, expectedBootstrapSql.length)).toEqual(expectedBootstrapSql);
  });
});
