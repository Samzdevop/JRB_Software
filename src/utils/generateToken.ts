import jwt from 'jsonwebtoken';


const generateToken = (user: {id: string; email: string}): string => {
    return jwt.sign(
        {id: user.id, email: user.email},
        process.env.JWT_SECRET as string,
        {
            expiresIn: process.env.JWT_EXPIRY || '1h',
        }
    );
};

export default generateToken;