"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRoles = void 0;
const requireRoles = (allowedRoles) => {
    return (req, res, next) => {
        const user = req.user;
        if (!user || !allowedRoles.includes(user.role)) {
            res.status(403).json({
                success: false,
                error: `Forbidden: Requires one of these roles: ${allowedRoles.join(', ')}`
            });
            return;
        }
        next();
    };
};
exports.requireRoles = requireRoles;
