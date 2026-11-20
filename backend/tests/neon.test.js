'use strict';

const { buildPoolConfig, directDatabaseUrl } = require('../src/config/poolConfig');

describe('configuración de Neon', () => {
  it('deriva la URL directa desde la URL pooler', () => {
    const pooled =
      'postgresql://user:p%40ss@ep-abc-pooler.us-east-1.aws.neon.tech/stockalert?sslmode=require';
    expect(directDatabaseUrl(pooled)).toBe(
      'postgresql://user:p%40ss@ep-abc.us-east-1.aws.neon.tech/stockalert?sslmode=require',
    );
  });

  it('respeta una URL directa ya configurada', () => {
    const direct =
      'postgresql://user:pass@ep-abc.us-east-1.aws.neon.tech/stockalert?sslmode=require';
    expect(directDatabaseUrl(direct)).toBe(direct);
  });

  it('fuerza TLS verificado en Neon y usa un pool pequeño', () => {
    const pooled =
      'postgresql://user:pass@ep-abc-pooler.us-east-1.aws.neon.tech/stockalert';
    const config = buildPoolConfig(pooled);

    expect(config.connectionString).toBe(pooled);
    expect(config.ssl).toEqual({ rejectUnauthorized: true });
    expect(config.max).toBe(5);
  });
});
