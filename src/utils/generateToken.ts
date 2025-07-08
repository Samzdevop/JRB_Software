import jwt from 'jsonwebtoken';

interface TokenPayload {
    id: string;
    email?: string
    phone?: string
}

const generateToken = (user: TokenPayload): string => {
    return jwt.sign(
        {
            id: user.id,
             ...(user.email && {email: user.email}),
             ...(user.phone && {phone: user.phone })
        },
        process.env.JWT_SECRET as string,
        {
            expiresIn: process.env.JWT_EXPIRY || '1h',
        }
    );
};

export default generateToken;