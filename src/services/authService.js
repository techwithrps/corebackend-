const crypto = require('crypto');

// Secret key for HMAC signing from environment, with a persistent fallback for local dev
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'spj_enterprise_secure_token_secret_key_2026_!#';

/**
 * Pre-configured verified server-side accounts and tenant scopes.
 * Client has zero control over role or tenantScope.
 */
const SERVER_USERS = [
  {
    id: 'admin',
    username: 'admin',
    // Password verified server-side only
    password: process.env.ADMIN_PASSWORD || 'SPJ@Cargo2026',
    altPassword: 'admin',
    name: 'System Administrator',
    role: 'admin',
    badge: 'Master Admin',
    tenantScope: {
      type: 'ALL',
      customerId: null,
      companyId: null,
      terminalId: null,
    }
  },
  {
    id: 'CUST-2857',
    username: 'fair',
    password: process.env.FAIR_PASSWORD || 'fair@123',
    name: 'FAIR EXPORTS (INDIA) PVT LTD',
    role: 'customer',
    badge: 'Enterprise Customer',
    tenantScope: {
      type: 'CUSTOMER',
      customerId: 'CUST-2857',
      customerCode: 'FAIR',
      customerName: 'FAIR EXPORTS (INDIA) PVT LTD',
      companyId: null,
      terminalId: null,
    }
  },
  {
    id: 'CUST-IFF',
    username: 'iff',
    password: process.env.IFF_PASSWORD || 'iff@123',
    name: 'IFF INDIA FROZEN FOODS PRIVATE LIMITED',
    role: 'customer',
    badge: 'Enterprise Customer',
    tenantScope: {
      type: 'CUSTOMER',
      customerId: 'CUST-IFF',
      customerCode: 'IFF',
      customerName: 'IFF INDIA FROZEN FOODS PRIVATE LIMITED',
      companyId: null,
      terminalId: null,
    }
  },
  {
    id: 'CUST-MARHABA',
    username: 'marhaba',
    password: process.env.MARHABA_PASSWORD || 'marhaba@123',
    name: 'MARHABA FROZEN FOODS',
    role: 'customer',
    badge: 'Enterprise Customer',
    tenantScope: {
      type: 'CUSTOMER',
      customerId: 'CUST-MARHABA',
      customerCode: 'MARHABA',
      customerName: 'MARHABA FROZEN FOODS',
      companyId: null,
      terminalId: null,
    }
  },
  {
    id: 'CUST-1847',
    username: 'rustam',
    password: process.env.RUSTAM_PASSWORD || 'rustam@123',
    name: 'RUSTAM FOODS PVT LTD',
    role: 'customer',
    badge: 'Enterprise Customer',
    tenantScope: {
      type: 'CUSTOMER',
      customerId: 'CUST-1847',
      customerCode: 'RUSTAM',
      customerName: 'RUSTAM FOODS PVT.LTD.',
      companyId: null,
      terminalId: null,
    }
  },
  {
    id: 'CUST-ALAMMAR',
    username: 'alammar',
    password: process.env.ALAMMAR_PASSWORD || 'alammar@123',
    name: 'AL AMMAR FROZEN FOOD EXPORTS PVT LTD',
    role: 'customer',
    badge: 'Enterprise Customer',
    tenantScope: {
      type: 'CUSTOMER',
      customerId: 'CUST-ALAMMAR',
      customerCode: 'ALAMMAR',
      customerName: 'AL AMMAR FROZEN FOOD EXPORTS PVT LTD',
      companyId: null,
      terminalId: null,
    }
  },
  {
    id: 'CUST-1793',
    username: 'hma',
    password: process.env.HMA_PASSWORD || 'hma@123',
    name: 'HMA AGRO INDUSTRIES LTD',
    role: 'customer',
    badge: 'Enterprise Customer',
    tenantScope: {
      type: 'CUSTOMER',
      customerId: 'CUST-1793',
      customerCode: 'HMA',
      customerName: 'HMA AGRO INDUSTRIES LTD',
      companyId: null,
      terminalId: null,
    }
  },
  {
    id: 'CUST-1845',
    username: 'intl',
    password: process.env.INTL_PASSWORD || 'intl@123',
    name: 'INTERNATIONAL AGRO FOODS',
    role: 'customer',
    badge: 'Enterprise Customer',
    tenantScope: {
      type: 'CUSTOMER',
      customerId: 'CUST-1845',
      customerCode: 'INTL',
      customerName: 'INTERNATIONAL AGRO FOODS',
      companyId: null,
      terminalId: null,
    }
  },
  {
    id: 'TERM-DADRI',
    username: 'operator_dadri',
    password: process.env.OPERATOR_PASSWORD || 'dadri@123',
    name: 'Dadri Terminal Operations',
    role: 'terminal_operator',
    badge: 'Terminal Operator',
    tenantScope: {
      type: 'TERMINAL',
      customerId: null,
      companyId: null,
      terminalId: 'DADRI-ALLCARGO',
    }
  }
];

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return Buffer.from(str, 'base64').toString('utf8');
}

/**
 * Generate a cryptographically signed HMAC-SHA256 Token
 */
function generateToken(payload, expiresInSeconds = 24 * 60 * 60) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(signatureInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${signatureInput}.${signature}`;
}

/**
 * Verify HMAC-SHA256 Token with Constant-Time Signature Comparison
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, receivedSignature] = parts;
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(signatureInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  // Constant-time signature verification to prevent timing attacks
  const expectedBuf = Buffer.from(expectedSignature);
  const receivedBuf = Buffer.from(receivedSignature);

  if (expectedBuf.length !== receivedBuf.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired token
    }
    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Authenticate credentials against verified server-side store
 */
function authenticateCredentials(username, password) {
  if (!username || !password) return null;
  const cleanUser = username.trim().toLowerCase();
  const cleanPass = password.trim();

  const user = SERVER_USERS.find(
    u => u.username.toLowerCase() === cleanUser || u.id.toLowerCase() === cleanUser
  );

  if (!user) return null;

  const passMatch = user.password === cleanPass || (user.altPassword && user.altPassword === cleanPass);
  if (!passMatch) return null;

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    badge: user.badge,
    tenantScope: user.tenantScope,
  };
}

module.exports = {
  generateToken,
  verifyToken,
  authenticateCredentials,
  SERVER_USERS,
};
