# Security Guidelines

## Secrets Management

### Environment Variables

- **Never commit secrets**: Use `.env` files (gitignored)
- **Use `.env.example`**: Template file with placeholder values
- **Production**: Use secret management services (AWS Secrets Manager, HashiCorp Vault)

### API Keys

- Store supplier API keys in environment variables
- Rotate keys regularly
- Use different keys per environment (dev, staging, prod)

### Database Credentials

- Store database URLs in environment variables
- Use strong passwords
- Limit database user permissions (read/write only, no admin)

## PII Considerations

### Personal Identifiable Information

**Current Scope:** Vehicle offers typically don't contain PII, but be aware:

- **Supplier contact information**: May contain names, emails
- **Customer data**: If suppliers include customer info, handle carefully
- **IP addresses**: Log IP addresses only if necessary for security

### Data Handling

- **Don't log PII**: Avoid logging personal information
- **Encrypt if needed**: If storing PII, encrypt at rest
- **Access controls**: Limit who can access data
- **Retention policies**: Define how long to keep data

## Partner Data Isolation

### Current (Single Tenant)

- All suppliers share same database
- No isolation needed for MVP

### Future (Multi-Tenant)

- **Database-level isolation**: Separate databases per tenant
- **Row-level security**: Use PostgreSQL RLS if shared database
- **Access controls**: Enforce tenant boundaries in application

## Audit Logging

### What to Log

- **Ingestion events**: Who ingested what, when
- **Match approvals/rejections**: Who reviewed matches
- **Override mappings**: Who created/modified mappings
- **Configuration changes**: Who changed system settings
- **Access attempts**: Failed authentication attempts

### Log Format

```typescript
{
  timestamp: '2024-01-15T10:30:00Z',
  event: 'match_approved',
  user: 'admin@example.com',
  match_id: 123,
  supplier_id: 'athlon',
  ip_address: '192.168.1.1'
}
```

### Storage

- Store audit logs in separate table or system
- Retain for compliance period (e.g., 7 years)
- Make logs tamper-evident (append-only)

## Input Validation

### File Uploads

- **Validate file types**: Only allow CSV, XLSX
- **Validate file size**: Limit maximum size (e.g., 100MB)
- **Sanitize file paths**: Prevent directory traversal
- **Scan for malware**: If accepting uploads from untrusted sources

### API Inputs

- **Validate all inputs**: Use schema validation (Zod, Joi)
- **Sanitize strings**: Escape SQL, prevent injection
- **Rate limiting**: Prevent abuse
- **Input size limits**: Limit request body size

## SQL Injection Prevention

### Use Parameterized Queries

```typescript
// Good
await db.query('SELECT * FROM offers WHERE supplier_id = $1', [supplierId]);

// Bad
await db.query(`SELECT * FROM offers WHERE supplier_id = '${supplierId}'`);
```

### ORM/Query Builder

- Use pg library's parameterized queries
- Consider using query builder (Knex.js) for complex queries
- Never concatenate user input into SQL

## Authentication & Authorization

### Current (CLI)

- No authentication needed (local execution)
- File system permissions control access

### Future (UI/API)

- **Authentication**: OAuth 2.0, JWT tokens
- **Authorization**: Role-based access control (RBAC)
- **Session management**: Secure session storage
- **Password policies**: Strong passwords, rotation

## Network Security

### API Connections

- **Use HTTPS**: Always use TLS for API calls
- **Certificate validation**: Verify SSL certificates
- **Timeout settings**: Set reasonable timeouts
- **Retry logic**: Don't retry forever (prevent DoS)

### Database Connections

- **Use SSL**: Enable SSL for database connections
- **Firewall rules**: Restrict database access to known IPs
- **Connection pooling**: Use connection pooling (prevent exhaustion)

## Error Handling

### Don't Expose Sensitive Information

```typescript
// Good
logger.error('Database error', { error: 'Connection failed' });
throw new Error('Failed to connect to database');

// Bad
logger.error('Database error', { error: error.message, password: dbPassword });
throw new Error(`Failed to connect: ${error.message}`);
```

### Error Messages

- Generic messages for users
- Detailed messages in logs (not exposed)
- Don't leak system information (paths, stack traces)

## Dependency Security

### Regular Updates

- Keep dependencies up to date
- Use `npm audit` to check for vulnerabilities
- Use Dependabot or similar for automated updates

### Dependency Review

- Review new dependencies before adding
- Prefer well-maintained packages
- Check for known vulnerabilities

## Compliance

### GDPR (if applicable)

- Right to access: Provide data export
- Right to deletion: Support data deletion
- Data minimization: Only collect needed data
- Consent: If collecting PII, get consent

### Data Retention

- Define retention policies
- Automate data deletion after retention period
- Document retention periods

## Security Checklist

- [ ] Secrets stored in environment variables (not code)
- [ ] `.env` file in `.gitignore`
- [ ] Database credentials secured
- [ ] API keys rotated regularly
- [ ] Input validation on all inputs
- [ ] SQL injection prevention (parameterized queries)
- [ ] Error messages don't expose sensitive info
- [ ] Dependencies up to date
- [ ] HTTPS for all external connections
- [ ] Audit logging implemented
- [ ] Access controls in place (future UI)
- [ ] Data retention policies defined

