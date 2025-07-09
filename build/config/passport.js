"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const passport_1 = __importDefault(require("passport"));
const passport_jwt_1 = require("passport-jwt");
const passport_google_oauth20_1 = require("passport-google-oauth20");
const prisma_1 = __importDefault(require("../prisma"));
const generateToken_1 = __importDefault(require("../utils/generateToken"));
passport_1.default.use(new passport_jwt_1.Strategy({
    jwtFromRequest: passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,
}, async (jwtPayload, done) => {
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id: jwtPayload.id },
        });
        if (!user)
            return done(null, false);
        return done(null, user);
    }
    catch (err) {
        return done(err, false);
    }
}));
passport_1.default.use(new passport_google_oauth20_1.Strategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK,
}, async (_accessToken, _refreshToken, profile, done) => {
    console.log(profile);
    try {
        const userObj = {
            googleId: profile.id,
            email: profile.emails[0].value,
            fullName: profile.displayName,
        };
        let userExist = await prisma_1.default.user.findFirst({
            where: { OR: [{ email: userObj.email }, { googleId: profile.id }] },
        });
        let user;
        let id = userExist?.id || '';
        // Don't persist existing users in the database
        if (!userExist) {
            user = await prisma_1.default.user.create({
                data: userObj,
            });
            id = user.id;
        }
        else {
            user = userExist;
        }
        const token = (0, generateToken_1.default)({ email: userObj.email, id });
        return done(null, { user, token });
    }
    catch (err) {
        return done(err, false);
    }
}));
exports.default = passport_1.default;
