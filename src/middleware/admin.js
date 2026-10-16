// Используется ПОСЛЕ authMiddleware — опирается на req.user,
// который кладёт туда authMiddleware из payload JWT.
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({
            error: "Доступ разрешён только администратору",
        });
    }
    next();
}

module.exports = requireAdmin;
