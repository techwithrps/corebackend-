const authService = require('../services/authService');

/**
 * Handle corporate user login
 */
async function login(req, res) {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required.',
      });
    }

    const user = authService.authenticateCredentials(username, password);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.',
      });
    }

    // Generate signed token valid for 24 hours
    const token = authService.generateToken({
      userId: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      badge: user.badge,
      tenantScope: user.tenantScope,
    });

    return res.json({
      success: true,
      message: 'Authentication successful',
      token,
      user,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Internal authentication error',
    });
  }
}

/**
 * Get current authenticated user profile
 */
async function getMe(req, res) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated',
    });
  }

  return res.json({
    success: true,
    user: req.user,
  });
}

module.exports = {
  login,
  getMe,
};
