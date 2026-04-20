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
import { documentRouter } from './routes/document.routes';
import { checklistRouter } from './routes/checkList.routes';
import { notesRouter } from './routes/notes.routes';
import path from 'path';
import { documentComparisonRouter } from './routes/documentComparison.routes';
import { taxQueryRouter } from './routes/taxQuery.routes';



export const app = express();

app.use(passport.initialize());

// Configuration
app.use(helmet());
app.use(cors({
	origin: process.env.CORS_ORIGIN || '*', // Allow all origins by default
	credentials: true, // Allow credentials if needed
	allowedHeaders: ['Content-Type', 'Authorization'],
}));
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
	res.json({ success: true, message: 'JRB API is working just fine!' });
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/documents', documentRouter);
app.use('/api/v1/checklists', checklistRouter);
app.use('/api/v1/notes', notesRouter);
app.use('/api/v1/document-comparison', documentComparisonRouter);
app.use('/api/v1/tax-query', taxQueryRouter);
// app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use(notFoundHandler);
app.use(errorHandler);