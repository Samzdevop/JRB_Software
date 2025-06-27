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

// import jwt from 'jsonwebtoken';

// interface TokenPayload {
//     id: string;
//     email: string;
// }

// const generateToken = (user: {id: string; email: string}): string => {
//     const payload: TokenPayload = {
//         id: user.id,
//         email: user.email
//     };

//     const secret: jwt.Secret = process.env.JWT_SECRET as string;
//     const options: jwt.SignOptions = {
//         expiresIn: (process.env.JWT_EXPIRY || '1h') as jwt.SignOptions['expiresIn']
//     };

//     return jwt.sign(payload, secret, options);
// };

// export default generateToken;

