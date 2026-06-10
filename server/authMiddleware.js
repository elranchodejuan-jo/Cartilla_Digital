const jwt = require('jsonwebtoken');

/**
 * Middleware para validar el token JWT y proteger rutas privadas.
 */
function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato: Bearer <token>
    
    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.veterinaria = decoded; // Contiene: id, email, nombre, iniciales
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Sesión inválida o expirada. Vuelva a iniciar sesión.' });
    }
}

module.exports = authMiddleware;
