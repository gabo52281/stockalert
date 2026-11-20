'use strict';

const { z } = require('zod');

const id = () => z.coerce.number().int().positive();
const optionalId = () => id().nullable().optional();
const date = () => z.coerce.date();

/**
 * Enteros estrictos para unidades físicas y valores monetarios COP.
 * Las cadenas deben contener solo dígitos: se rechazan decimales, signos,
 * notación científica y espacios. Los números deben ser enteros reales.
 */
const integerFrom = (minimum, maximum) => z.preprocess(
  (value) => {
    if (typeof value === 'string') {
      const text = value.trim();
      return /^\d+$/.test(text) ? Number(text) : Number.NaN;
    }
    return value;
  },
  z.number().int().min(minimum).max(maximum ?? Number.MAX_SAFE_INTEGER),
);

const units = () => integerFrom(0);
const positiveUnits = () => integerFrom(1);
const money = () => integerFrom(0);
const percentage = () => integerFrom(0, 100);
const analysisDays = () => integerFrom(1, 365);

const pagination = {
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
};

// ---------------------------------------------------------------------------
// Autenticación y usuarios
// ---------------------------------------------------------------------------
const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email().max(180),
    password: z.string().min(1).max(200),
  }),
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(100),
  }),
});

const userCreateSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(180),
    password: z.string().min(8).max(100),
    role: z.enum(['ADMINISTRADOR', 'ENCARGADO_INVENTARIO', 'CONSULTA']),
    active: z.boolean().default(true),
  }),
});

const userUpdateSchema = z.object({
  params: z.object({ id: id() }),
  body: z.object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().email().max(180).optional(),
    role: z.enum(['ADMINISTRADOR', 'ENCARGADO_INVENTARIO', 'CONSULTA']).optional(),
    active: z.boolean().optional(),
  }),
});

const userIdSchema = z.object({ params: z.object({ id: id() }) });

const resetPasswordSchema = z.object({
  params: z.object({ id: id() }),
  body: z.object({ password: z.string().min(8).max(100) }),
});

// ---------------------------------------------------------------------------
// Catálogos
// ---------------------------------------------------------------------------
const categoryCreateSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).nullable().optional(),
    active: z.boolean().default(true),
  }),
});

const categoryUpdateSchema = z.object({
  params: z.object({ id: id() }),
  body: categoryCreateSchema.shape.body.partial(),
});

const supplierCreateSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(180),
    taxId: z.string().trim().max(40).nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    email: z.string().trim().email().max(180).nullable().optional(),
    address: z.string().trim().max(255).nullable().optional(),
    contactPerson: z.string().trim().max(120).nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    active: z.boolean().default(true),
  }),
});

const supplierUpdateSchema = z.object({
  params: z.object({ id: id() }),
  body: supplierCreateSchema.shape.body.partial(),
});

const catalogQuerySchema = z.object({
  query: z.object({
    ...pagination,
    q: z.string().trim().max(120).optional(),
    status: z.enum(['active', 'inactive', 'all']).default('active'),
  }),
});

// ---------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------
const productBody = z.object({
  code: z.string().trim().min(1).max(60),
  name: z.string().trim().min(2).max(180),
  description: z.string().trim().max(1000).nullable().optional(),
  categoryId: optionalId(),
  supplierId: optionalId(),
  purchasePrice: money().default(0),
  salePrice: money().default(0),
  minStock: units().default(0),
  alertPercentage: percentage().default(25),
  active: z.boolean().default(true),
});

const productCreateSchema = z.object({ body: productBody });

const productUpdateSchema = z.object({
  params: z.object({ id: id() }),
  body: productBody.partial(),
});

const productQuerySchema = z.object({
  query: z.object({
    ...pagination,
    q: z.string().trim().max(120).optional(),
    categoryId: optionalId(),
    supplierId: optionalId(),
    status: z.enum(['active', 'inactive', 'all']).default('active'),
    alertLevel: z.enum(['NORMAL', 'BAJO', 'CRITICO', 'AGOTADO']).optional(),
    sortBy: z.enum(['code', 'name', 'quantity', 'minStock', 'createdAt', 'salePrice']).default('name'),
    sortDir: z.enum(['asc', 'desc']).default('asc'),
  }),
});

const productIdSchema = z.object({ params: z.object({ id: id() }) });

const alertSettingsSchema = z.object({
  params: z.object({ id: id() }),
  body: z.object({
    preventivePercentage: percentage(),
    analysisWindowDays: analysisDays().default(30),
    minHistoryDays: analysisDays().default(7),
  }),
});

// ---------------------------------------------------------------------------
// Movimientos
// ---------------------------------------------------------------------------
const movementInSchema = z.object({
  body: z.object({
    productId: id(),
    quantity: positiveUnits(),
    supplierId: optionalId(),
    notes: z.string().trim().max(1000).nullable().optional(),
    movementDate: date().optional(),
  }),
});

const movementOutSchema = z.object({
  body: z.object({
    productId: id(),
    quantity: positiveUnits(),
    reason: z.string().trim().min(1).max(180),
    notes: z.string().trim().max(1000).nullable().optional(),
    movementDate: date().optional(),
  }),
});

const movementQuerySchema = z.object({
  query: z.object({
    ...pagination,
    productId: optionalId(),
    categoryId: optionalId(),
    userId: optionalId(),
    supplierId: optionalId(),
    type: z.enum(['IN', 'OUT']).optional(),
    from: date().optional(),
    to: date().optional(),
    sortDir: z.enum(['asc', 'desc']).default('desc'),
  }),
});

const movementIdSchema = z.object({ params: z.object({ id: id() }) });

// ---------------------------------------------------------------------------
// Alertas, indicadores y reportes
// ---------------------------------------------------------------------------
const alertQuerySchema = z.object({
  query: z.object({
    ...pagination,
    level: z.enum(['NORMAL', 'BAJO', 'CRITICO', 'AGOTADO']).optional(),
    categoryId: optionalId(),
    q: z.string().trim().max(120).optional(),
  }),
});

const indicatorQuerySchema = z.object({
  query: z.object({
    days: z.coerce.number().int().min(1).max(365).default(30),
    ...pagination,
  }),
});

const reportNameSchema = z.object({
  params: z.object({
    report: z.enum([
      'inventory', 'low-stock', 'critical', 'movements-in', 'movements-out',
      'movements-range', 'movements-by-user', 'top-products', 'coverage', 'valuation',
    ]),
  }),
});

const reportQuerySchema = z.object({
  query: z.object({
    from: date().optional(),
    to: date().optional(),
    productId: optionalId(),
    categoryId: optionalId(),
    userId: optionalId(),
    type: z.enum(['IN', 'OUT']).optional(),
    status: z.enum(['NORMAL', 'BAJO', 'CRITICO', 'AGOTADO', 'active', 'inactive']).optional(),
    format: z.enum(['json', 'csv', 'pdf']).default('json'),
  }),
});

const reportRequestSchema = z.object({
  params: reportNameSchema.shape.params,
  query: reportQuerySchema.shape.query,
});

const dashboardQuerySchema = z.object({
  query: z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }),
});

const aiQuerySchema = z.object({
  query: z.object({
    days: z.coerce.number().int().min(7).max(365).default(30),
    leadTimeDays: z.coerce.number().int().min(1).max(90).default(14),
    limit: z.coerce.number().int().min(1).max(20).default(8),
  }),
});

// ---------------------------------------------------------------------------
// Esquemas auxiliares
// ---------------------------------------------------------------------------
const boolQuery = z.enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

const userQuerySchema = z.object({
  query: z.object({
    ...pagination,
    q: z.string().trim().max(120).optional(),
    role: z.enum(['ADMINISTRADOR', 'ENCARGADO_INVENTARIO', 'CONSULTA']).optional(),
    active: boolQuery,
  }),
});

const activeToggleSchema = z.object({
  params: z.object({ id: id() }),
  body: z.object({ active: z.boolean() }),
});

const categoryIdSchema = z.object({ params: z.object({ id: id() }) });
const supplierIdSchema = z.object({ params: z.object({ id: id() }) });

module.exports = {
  userQuerySchema,
  activeToggleSchema,
  categoryIdSchema,
  supplierIdSchema,
  loginSchema,
  changePasswordSchema,
  userCreateSchema,
  userUpdateSchema,
  userIdSchema,
  resetPasswordSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  supplierCreateSchema,
  supplierUpdateSchema,
  catalogQuerySchema,
  productCreateSchema,
  productUpdateSchema,
  productQuerySchema,
  productIdSchema,
  alertSettingsSchema,
  movementInSchema,
  movementOutSchema,
  movementQuerySchema,
  movementIdSchema,
  alertQuerySchema,
  indicatorQuerySchema,
  reportNameSchema,
  reportQuerySchema,
  reportRequestSchema,
  dashboardQuerySchema,
  aiQuerySchema,
};
