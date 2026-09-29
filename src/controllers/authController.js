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

/**
 * Admin: List all user accounts
 */
async function getUsers(req, res) {
  try {
    const users = authService.getAllUsers();
    return res.json({
      success: true,
      users,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user accounts',
    });
  }
}

/**
 * Admin: Create a new user account
 */
async function createUser(req, res) {
  try {
    const { username, password, name, role, customerId, customerName } = req.body || {};
    const newUser = authService.createNewUser({
      username,
      password,
      name,
      role,
      customerId,
      customerName,
    });
    return res.json({
      success: true,
      message: 'User account created successfully',
      user: newUser,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to create user account',
    });
  }
}

/**
 * Admin: Delete user account
 */
async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const deleted = authService.deleteUser(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'User account not found or cannot be deleted',
      });
    }
    return res.json({
      success: true,
      message: 'User account deleted successfully',
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete user account',
    });
  }
}

module.exports = {
  login,
  getMe,
  getUsers,
  createUser,
  deleteUser,
};

