const crypto = require('crypto');
const authService = require('../services/authService');

/**
 * Authentication Middleware
 * Validates cryptographically signed Bearer tokens.
 * Injects verified req.user.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || req.headers['x-auth-token'];

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Missing Authorization token.',
    });
  }

  let token = authHeader;
  if (authHeader.startsWith('Bearer ') || authHeader.startsWith('bearer ')) {
    token = authHeader.slice(7).trim();
  }

  const user = authService.verifyToken(token);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication failed. Invalid or expired token.',
    });
  }

  // Bind verified user identity to request lifecycle
  req.user = user;
  next();
}

/**
 * Tenant Isolation & Scope Enforcement Middleware
 * Ensures client filters can only narrow an already-authorized scope,
 * and never expand permissions or access another tenant's data.
 */
function enforceTenantScope(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required before tenant authorization.',
    });
  }

  const { role, tenantScope } = req.user;

  // Admins have unrestricted enterprise access across all companies, terminals, and customers
  if (role === 'admin' || role === 'system_admin' || !tenantScope || tenantScope.type === 'ALL') {
    return next();
  }

  // 1. Customer Tenant Isolation
  if (role === 'customer' || tenantScope.type === 'CUSTOMER') {
    const authorizedCustId = String(tenantScope.customerId || '').trim();
    const authorizedCustCode = String(tenantScope.customerCode || '').trim();
    const requestedCustId = req.query.customerId || req.body?.customerId;

    if (requestedCustId && requestedCustId !== 'all' && requestedCustId !== 'ALL') {
      const cleanReq = String(requestedCustId).trim().toUpperCase();
      const match =
        cleanReq === authorizedCustId.toUpperCase() ||
        (authorizedCustCode && cleanReq === authorizedCustCode.toUpperCase());

      if (!match) {
        // Rule 6: Client requested a different customer's data -> Reject immediately
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You are not authorized to view records for this customer account.',
        });
      }
    } else {
      // Rule 7: customerId omitted -> Force server-side tenant scope
      req.query.customerId = authorizedCustId || authorizedCustCode;
    }
  }

  // 2. Terminal Isolation
  if (role === 'terminal_operator' || tenantScope.type === 'TERMINAL') {
    const authorizedTerminal = String(tenantScope.terminalId || '').trim();
    const requestedTerminal = req.query.terminalId || req.body?.terminalId;

    if (requestedTerminal && requestedTerminal !== 'all' && requestedTerminal !== 'ALL') {
      if (String(requestedTerminal).trim().toUpperCase() !== authorizedTerminal.toUpperCase()) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You are not authorized to view records for this terminal.',
        });
      }
    } else {
      req.query.terminalId = authorizedTerminal;
    }
  }

  // 3. Company Isolation
  if (role === 'company_user' || tenantScope.type === 'COMPANY') {
    const authorizedCompany = String(tenantScope.companyId || '').trim();
    const requestedCompany = req.query.companyId || req.body?.companyId;

    if (requestedCompany && requestedCompany !== 'all' && requestedCompany !== 'ALL') {
      if (String(requestedCompany).trim() !== authorizedCompany) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You are not authorized to view records for this company.',
        });
      }
    } else {
      req.query.companyId = authorizedCompany;
    }
  }

  next();
}

/**
 * Role-Based Access Control Middleware
 */
function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access requires one of [${allowedRoles.join(', ')}] role.`,
      });
    }

    next();
  };
}

/**
 * Administrative Authentication Guard
 * Protects administrative maintenance endpoints (/sync-warehouse, /cache-flush, /cache-stats).
 * Rejects query-parameter keys. Requires header x-admin-key with timing-safe comparison,
 * or authenticated admin user session.
 */
function adminAuth(req, res, next) {
  // 1. Allow authenticated user with 'admin' role
  if (req.user && (req.user.role === 'admin' || req.user.role === 'system_admin')) {
    return next();
  }

  // 2. Also check if Bearer token was provided in headers
  const authHeader = req.headers.authorization || req.headers['x-auth-token'];
  if (authHeader) {
    let token = authHeader;
    if (authHeader.startsWith('Bearer ') || authHeader.startsWith('bearer ')) {
      token = authHeader.slice(7).trim();
    }
    const user = authService.verifyToken(token);
    if (user && (user.role === 'admin' || user.role === 'system_admin')) {
      req.user = user;
      return next();
    }
  }

  // 3. Or allow secure x-admin-key header
  const adminSecret = process.env.ADMIN_SECRET_KEY;
  if (!adminSecret) {
    return res.status(403).json({
      success: false,
      message: 'Administrative endpoint disabled. Set ADMIN_SECRET_KEY to enable.',
    });
  }

  const providedKey = req.headers['x-admin-key'];

  if (!providedKey || typeof providedKey !== 'string') {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing administrator key header (x-admin-key).',
    });
  }

  const expectedBuf = Buffer.from(adminSecret);
  const providedBuf = Buffer.from(providedKey);

  if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid administrator key.',
    });
  }

  next();
}

/**
 * In-Memory Sliding-Window Rate Limiter for Heavy Endpoints (e.g., Excel Export)
 * Max 10 exports per 60 seconds per IP / User
 */
const exportRateLimitTracker = new Map();

function rateLimitExport(req, res, next) {
  const identifier = req.user?.userId || req.ip || 'anonymous';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 10;

  let record = exportRateLimitTracker.get(identifier);
  if (!record || now - record.startTime > windowMs) {
    record = { startTime: now, count: 1 };
    exportRateLimitTracker.set(identifier, record);
    return next();
  }

  if (record.count >= maxRequests) {
    return res.status(429).json({
      success: false,
      message: 'Too many export requests. Rate limit is 10 requests per minute. Please try again later.',
    });
  }

  record.count++;
  next();
}

module.exports = {
  authenticate,
  enforceTenantScope,
  requireRole,
  adminAuth,
  rateLimitExport,
};
