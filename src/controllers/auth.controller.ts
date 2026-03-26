import express from 'express';
import { AuthService } from '../services/auth.services.ts';

type Request = express.Request;
type Response = express.Response;

export const AuthController = {
    
   // 1. REGISTER (Now with Auto-Login!)
    async register(req: Request, res: Response) {
        try {
            const { email, password } = req.body;
            console.log("Registering user with email:", email);
            // 1. Create the user in the database
            await AuthService.registerUser(req.body);
            console.log("User registered successfully. Proceeding to login...");
            
            // 2. Immediately log them in using the exact same credentials!
            const { user, accessToken, refreshToken } = await AuthService.loginUser(email, password);
            console.log("User logged in successfully after registration. Baking cookies...");

            // 3. Bake the Access Token Cookie (15 Minutes)
            res.cookie('accessToken', accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 15 * 60 * 1000
            });

            // 4. Bake the Refresh Token Cookie (7 Days)
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            // 5. Send back the 201 Created with the user state for React
            res.status(201).json({ 
                success: true, 
                message: "User registered and logged in successfully!",
                user: { id: user.id, username: user.username, email: user.email }
            });

        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    },
    // 2. LOGIN (The Cookie Baker)
    async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body;
            
            // Ask the Service to verify credentials and generate tokens
            const { user, accessToken, refreshToken } = await AuthService.loginUser(email, password);

            // 🍪 Bake the Access Token Cookie (15 Minutes)
            res.cookie('accessToken', accessToken, {
                httpOnly: true, // JavaScript CANNOT read this (Defeats XSS)
                secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
                sameSite: 'strict', // Defeats CSRF attacks
                maxAge: 15 * 60 * 1000 // 15 minutes in milliseconds
            });

            // 🍪 Bake the Refresh Token Cookie (7 Days)
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
            });

            // Send back standard user data for the React frontend state (NO TOKENS IN THE BODY!)
            res.status(200).json({
                success: true,
                user: { id: user.id, username: user.username, email: user.email }
            });
        } catch (error: any) {
            res.status(401).json({ success: false, message: error.message });
        }
    },

    // 3. LOGOUT (The Kill Switch)
    async logout(req: Request, res: Response) {
        // Clear the cookies from the browser
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        
        res.status(200).json({ success: true, message: "Logged out successfully." });
    }
};