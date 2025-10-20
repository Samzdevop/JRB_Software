"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const logger_1 = __importDefault(require("./config/logger"));
const auth_routes_1 = require("./routes/auth.routes");
const notFoundRoute_1 = require("./middlewares/notFoundRoute");
const errorHandler_1 = require("./middlewares/errorHandler");
const users_routes_1 = require("./routes/users.routes");
const passport_1 = __importDefault(require("passport"));
require("./config/passport");
const document_routes_1 = require("./routes/document.routes");
const checkList_routes_1 = require("./routes/checkList.routes");
const notes_routes_1 = require("./routes/notes.routes");
exports.app = (0, express_1.default)();
exports.app.use(passport_1.default.initialize());
// Configuration
exports.app.use((0, helmet_1.default)());
exports.app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || '*', // Allow all origins by default
    credentials: true, // Allow credentials if needed
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
exports.app.use(express_1.default.json());
(0, morgan_1.default)('tiny');
const stream = {
    write: (text) => {
        logger_1.default.info(text);
    },
};
exports.app.use((0, morgan_1.default)(':method :url :status :response-time ms - :res[content-length]', {
    stream,
}));
exports.app.get('/', (_req, res) => {
    res.json({ success: true, message: 'Wrightenergy API is working just fine!' });
});
exports.app.use('/api/v1/auth', auth_routes_1.authRouter);
exports.app.use('/api/v1/users', users_routes_1.usersRouter);
exports.app.use('/api/v1/documents', document_routes_1.documentRouter);
exports.app.use('/api/v1/checklists', checkList_routes_1.checklistRouter);
exports.app.use('/api/v1/notes', notes_routes_1.notesRouter);
// app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
exports.app.use(notFoundRoute_1.notFoundHandler);
exports.app.use(errorHandler_1.errorHandler);
