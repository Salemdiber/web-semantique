function requireUser(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'client') {
    return res.status(401).json({ error: 'Connectez-vous pour consulter votre compte.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(401).json({ error: 'Accès réservé à l’administration.' });
  }
  next();
}

function requireAuthenticated(req, res, next) {
  if (!req.session.user || !['admin', 'client'].includes(req.session.user.role)) {
    return res.status(401).json({ error: 'Connectez-vous pour accéder aux paramètres de votre compte.' });
  }
  next();
}

module.exports = { requireUser, requireAdmin, requireAuthenticated };
