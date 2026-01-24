# Design Guidelines

## Code Style

### TypeScript Conventions

- **Use strict TypeScript**: Enable all strict checks in `tsconfig.json`
- **Prefer interfaces over types**: For object shapes that may be extended
- **Use type aliases**: For unions, intersections, and complex types
- **Avoid `any`**: Use `unknown` and type guards instead
- **Explicit return types**: For public functions (helps with documentation)

**Example:**
```typescript
// Good
interface RawSupplierOffer {
  supplierId: string;
  make: string | null;
}

function processOffer(offer: RawSupplierOffer): Promise<NormalizedOffer> {
  // ...
}

// Avoid
function processOffer(offer: any): any {
  // ...
}
```

### Naming Conventions

- **Files**: `camelCase.ts` for regular files, `PascalCase.ts` for classes/components
- **Variables/Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Types/Interfaces**: `PascalCase`
- **Private members**: Prefix with `_` if needed for clarity

**Example:**
```typescript
// File: normalizeOffer.ts
const MAX_RETRIES = 3;

interface NormalizedOffer {
  make: string;
}

function normalizeMake(rawMake: string | null): string {
  // ...
}
```

### File Organization

- **One main export per file**: Export the primary function/class
- **Group related exports**: Use `index.ts` files for barrel exports
- **Keep files focused**: One responsibility per file
- **Co-locate tests**: `file.test.ts` next to `file.ts`

### Import Organization

1. External dependencies (Node.js, npm packages)
2. Internal modules (domain, utils)
3. Relative imports (same directory)

**Example:**
```typescript
import { readFile } from 'fs/promises';
import { parse } from 'csv-parse';

import { RawSupplierOffer } from '../domain/types';
import { logger } from '../utils/logger';

import { parseAthlonRow } from './parser';
```

## Error Handling

### Error Types

Define custom error classes for different error categories:

```typescript
class IngestionError extends Error {
  constructor(
    message: string,
    public readonly supplierId: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'IngestionError';
  }
}

class NormalizationError extends Error {
  constructor(
    message: string,
    public readonly rawOffer: RawSupplierOffer,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'NormalizationError';
  }
}
```

### Error Handling Patterns

**Option 1: Try/Catch with Typed Errors**
```typescript
try {
  const offers = await ingestFile(filePath);
  return { success: true, data: offers };
} catch (error) {
  if (error instanceof IngestionError) {
    logger.error('Ingestion failed', { supplierId: error.supplierId, error });
    return { success: false, error: error.message };
  }
  throw error; // Re-throw unknown errors
}
```

**Option 2: Result Type**
```typescript
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

async function ingestFile(filePath: string): Promise<Result<RawSupplierOffer[]>> {
  try {
    const offers = await parseFile(filePath);
    return { success: true, data: offers };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}
```

### Error Logging

- **Log errors with context**: Include relevant data (supplier ID, offer ID, etc.)
- **Use appropriate log levels**: ERROR for failures, WARN for recoverable issues
- **Include stack traces**: For debugging (in development)

**Example:**
```typescript
logger.error('Failed to normalize offer', {
  supplierId: offer.supplierId,
  offerId: offer.supplierOfferId,
  error: error.message,
  stack: error.stack,
});
```

## Logging

### Logger Interface

Use structured logging with consistent fields:

```typescript
interface LogContext {
  [key: string]: unknown;
}

interface Logger {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
}
```

### Log Levels

- **DEBUG**: Detailed information for debugging (development only)
- **INFO**: General informational messages (ingestion started, completed)
- **WARN**: Warning messages (partial failures, retries)
- **ERROR**: Error messages (failures, exceptions)

### Logging Best Practices

1. **Include context**: Always include relevant IDs, timestamps, counts
2. **Structured data**: Use objects, not string interpolation
3. **Avoid sensitive data**: Don't log passwords, API keys, PII
4. **Consistent format**: Use same field names across logs

**Example:**
```typescript
// Good
logger.info('Ingestion started', {
  supplierId: 'athlon',
  mode: 'file',
  filePath: './data/athlon.csv',
  rowCount: 150,
});

// Avoid
logger.info(`Ingestion started for athlon from ./data/athlon.csv with 150 rows`);
```

## Testing Approach

### Test Structure

- **Unit tests**: Test individual functions in isolation
- **Integration tests**: Test component interactions (database, file system)
- **E2E tests**: Test complete pipeline (ingest → normalize → match → export)

### Test Organization

```
src/
  normalization/
    normalizeOffer.ts
    normalizeOffer.test.ts
  matching/
    matchOffer.ts
    matchOffer.test.ts
```

### Testing Patterns

**Unit Test Example:**
```typescript
import { describe, it, expect } from 'vitest';
import { normalizeMake } from './normalizeOffer';

describe('normalizeMake', () => {
  it('should convert VW to volkswagen', () => {
    expect(normalizeMake('VW')).toBe('volkswagen');
  });

  it('should handle null input', () => {
    expect(normalizeMake(null)).toBe('');
  });

  it('should handle empty string', () => {
    expect(normalizeMake('')).toBe('');
  });
});
```

**Integration Test Example:**
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ingestAthlonFile } from '../connectors/athlonFile';
import { db } from '../db';

describe('Athlon file ingestion', () => {
  beforeAll(async () => {
    await db.migrate();
  });

  afterAll(async () => {
    await db.close();
  });

  it('should ingest CSV file and store in database', async () => {
    const offers = await ingestAthlonFile('./test-data/athlon-sample.csv');
    expect(offers).toHaveLength(10);
    
    const stored = await db.query('SELECT * FROM raw_offers WHERE supplier_id = $1', ['athlon']);
    expect(stored.rows).toHaveLength(10);
  });
});
```

### Test Data

- **Use fixtures**: Store test data in `test-data/` directory
- **Mock external dependencies**: Mock API calls, file system operations
- **Use test database**: Separate test database (or in-memory)

## Code Documentation

### Function Documentation

Use JSDoc comments for public functions:

```typescript
/**
 * Normalizes a supplier offer by standardizing make, model, trim, and other fields.
 *
 * @param rawOffer - The raw supplier offer to normalize
 * @returns A normalized offer with standardized fields
 * @throws {NormalizationError} If normalization fails critically
 *
 * @example
 * ```typescript
 * const normalized = await normalizeOffer(rawOffer);
 * console.log(normalized.make); // "volkswagen" (normalized)
 * ```
 */
export async function normalizeOffer(
  rawOffer: RawSupplierOffer
): Promise<NormalizedOffer> {
  // ...
}
```

### Type Documentation

Document complex types:

```typescript
/**
 * Represents a match result between a supplier offer and a canonical vehicle.
 *
 * @property id - Unique match identifier
 * @property confidenceScore - Match confidence (0.0 to 1.0)
 * @property matchType - How the match was determined ('deterministic', 'scored', 'override')
 * @property status - Match review status ('pending', 'approved', 'rejected', 'review')
 */
interface MatchResult {
  id: number;
  confidenceScore: number;
  matchType: 'deterministic' | 'scored' | 'override';
  status: 'pending' | 'approved' | 'rejected' | 'review';
  // ...
}
```

## Performance Considerations

### Database Queries

- **Use indexes**: Ensure indexes exist for common query patterns
- **Batch operations**: Use `INSERT ... VALUES (...), (...), (...)` for bulk inserts
- **Connection pooling**: Use connection pool for database connections
- **Avoid N+1 queries**: Use JOINs or batch queries

### Memory Management

- **Stream large files**: Don't load entire file into memory
- **Process in batches**: Process offers in chunks (100-1000 at a time)
- **Clean up resources**: Close file handles, database connections

### Async Operations

- **Use async/await**: Prefer over callbacks or promises
- **Parallelize when safe**: Use `Promise.all()` for independent operations
- **Handle concurrency**: Use semaphores or queues for rate-limited operations

## Security Considerations

### Input Validation

- **Validate file paths**: Prevent directory traversal attacks
- **Validate file sizes**: Limit maximum file size
- **Sanitize inputs**: Escape SQL, prevent injection attacks

### Secrets Management

- **Never commit secrets**: Use environment variables
- **Use .env files**: For local development (gitignored)
- **Use secret management**: For production (AWS Secrets Manager, etc.)

### Data Privacy

- **Don't log PII**: Avoid logging personal information
- **Encrypt sensitive data**: If storing PII in database
- **Access controls**: Implement authentication/authorization for future UI

## Code Review Checklist

- [ ] Code follows TypeScript conventions
- [ ] Error handling is appropriate
- [ ] Logging includes context
- [ ] Tests are included (unit or integration)
- [ ] Documentation is updated
- [ ] No secrets or sensitive data committed
- [ ] Performance considerations addressed
- [ ] Security considerations addressed

