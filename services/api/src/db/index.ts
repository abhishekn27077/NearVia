/**
 * NEARVIA Database Client & Connection Pool
 * Provides connection pooling, typed query execution, and PostGIS helper utilities.
 */

import { Pool, PoolConfig, QueryResult, QueryResultRow } from "pg";
import { env } from "../config";

let poolInstance: Pool | null = null;

export function getPoolConfig(): PoolConfig {
  if (env.DATABASE_URL) {
    return {
      connectionString: env.DATABASE_URL,
      ssl:
        env.DATABASE_URL.includes("supabase.co") || env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };
  }

  return {
    host: env.API_HOST,
    port: 5432,
    database: "nearvia_db",
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
}

export function getPool(): Pool {
  if (!poolInstance) {
    poolInstance = new Pool(getPoolConfig());

    poolInstance.on("error", (err) => {
      console.error("Unexpected error on idle database client:", err);
    });
  }
  return poolInstance;
}

/**
 * Execute a parameterized query with connection safety
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  const pool = getPool();
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (env.NODE_ENV !== "test") {
      console.log(
        `[DB] Executed query in ${duration}ms, rows: ${res.rowCount}`,
      );
    }
    return res;
  } catch (error) {
    console.error(`[DB Error] Query failed: ${text}`, error);
    throw error;
  }
}

/**
 * Spatial Query Helper: Construct a PostGIS ST_DWithin query for hyperlocal search
 * @param targetPoint Latitude and Longitude of search center
 * @param radiusKm Radius in kilometers (default: 5 km)
 */
export function buildSpatialProximityQuery(radiusKm = 5.0): {
  filterSql: string;
  distanceSql: string;
} {
  const radiusMeters = radiusKm * 1000;
  return {
    // Spatial proximity filter using PostGIS indexed geodesic geography
    filterSql: `ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, ${radiusMeters})`,
    // Exact geodesic distance calculation in meters
    distanceSql: `ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)`,
  };
}

/**
 * Execute a unit of work inside a database transaction with automatic commit/rollback
 */
export async function withTransaction<T>(
  callback: (client: {
    query: <R extends QueryResultRow = QueryResultRow>(
      text: string,
      params?: unknown[],
    ) => Promise<QueryResult<R>>;
  }) => Promise<T>,
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("[DB Error] Rollback failed:", rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Gracefully close the database pool
 */
export async function closePool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}
