import dotenv from 'dotenv';

dotenv.config();

console.log('Environment loaded:', process.env.JWT_SECRET ? 'Yes' : 'No');


export const config = {
    PORT: process.env.PORT || 5000,
};