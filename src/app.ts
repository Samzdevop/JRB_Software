import express, { Response, Request } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import Logger from './config/logger';
import { authRouter } from './routes/auth.routes';
import { notFoundHandler } from './middlewares/notFoundRoute';
import { errorHandler } from './middlewares/errorHandler';
import { usersRouter } from './routes/users.routes';
import passport from 'passport';
import './config/passport';

export const app = express();

app.use(passport.initialize());

// Configuration
app.use(helmet());
app.use(cors());
app.use(express.json());

morgan('tiny');
const stream = {
	write: (text: string) => {
		Logger.info(text);
	},
};

app.use(
	morgan(':method :url :status :response-time ms - :res[content-length]', {
		stream,
	})
);

app.get('/', (_req: Request, res: Response) => {
	res.json({ success: true, message: 'Agritech API is working just fine!' });
});

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);

app.use(notFoundHandler);
app.use(errorHandler);