import dotenv from 'dotenv';


console.log('Environment loaded:', process.env.JWT_SECRET ? 'Yes' : 'No');

dotenv.config();

export const config = {
    PORT: process.env.PORT || 5000,
};