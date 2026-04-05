/**
 * Turso HTTP pipeline client for mobile sync.
 * Sends batched SQL statements to Turso's HTTP API.
 */

export interface TursoArg {
  type: 'text' | 'integer' | 'float' | 'null';
  value?: string | null;
}

export interface TursoStatement {
  type: 'execute' | 'close';
  stmt?: { sql: string; args?: TursoArg[] };
}

export interface TursoPipelineResponse {
  results: Array<{
    type: 'ok' | 'error';
    response?: {
      type: string;
      result?: {
        cols: Array<{ name: string }>;
        rows: Array<Array<{ type: string; value: string | null }>>;
      };
    };
    error?: { message: string };
  }>;
}

/** Wrap a string value for Turso pipeline args. */
export function tursoText(val: string): TursoArg {
  return { type: 'text', value: val };
}

/** Wrap a null value for Turso pipeline args. */
export function tursoNull(): TursoArg {
  return { type: 'null' };
}

/** Wrap an optional string as text or null. */
export function tursoTextOrNull(val: string | null | undefined): TursoArg {
  return val != null ? tursoText(val) : tursoNull();
}

/** Build an execute statement for a Turso pipeline. */
export function tursoExecute(sql: string, args: TursoArg[] = []): TursoStatement {
  return { type: 'execute', stmt: { sql, args } };
}

/**
 * Send a pipeline of SQL statements to Turso's HTTP API.
 * Automatically appends a 'close' statement and normalizes the URL.
 */
export async function tursoPipeline(
  tursoUrl: string,
  tursoToken: string,
  statements: TursoStatement[]
): Promise<TursoPipelineResponse> {
  // Normalize URL: libsql:// -> https://, strip trailing slash
  const baseUrl = tursoUrl
    .trim()
    .replace(/\/+$/, '')
    .replace('libsql://', 'https://');

  const requests = [...statements, { type: 'close' as const }];

  const response = await fetch(`${baseUrl}/v2/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tursoToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Turso error ${response.status}: ${body}`);
  }

  return response.json();
}
