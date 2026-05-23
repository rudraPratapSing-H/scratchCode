import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import http from 'http';
import { setupRoutes } from './routes/index.ts';
import { authRoutes } from './routes/auth.route.ts';
import { requireAuth } from './middlewares/requireAuth.ts';

const app: any = express();

app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174'], // Allow Vite frontend on common ports
    credentials: true,               // CRITICAL: Allows cookies/tokens to be sent back and forth
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const server = http.createServer(app);
const port = Number(process.env.PORT) || 8000;

app.use('/api', setupRoutes());
app.use('/api/auth', authRoutes());

server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Stop the existing process or set a different PORT.`);
        process.exit(1);
    }

    console.error('Server failed to start:', error.message);
    process.exit(1);
});

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
