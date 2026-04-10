import express from 'express';
import { AuthService } from '../services/auth.services.ts';

type Request = express.Request;
type Response = express.Response;

export const AuthController = {
   // for autologin if valid refresh token exists, otherwise behaves like a normal login
//    async autoLogin(req: Request, res: Response) {
        
    // 1. REGISTER (Starts the OTP flow)
    async register(req: Request, res: Response) {
        try {
            const { email } = req.body;
            console.log("Registering user with email:", email);
            
            // Call the service: this now generates an OTP and saves to Redis, NOT Postgres.
            const response = await AuthService.registerUser(req.body);
            
            // Return the prompt to check email for OTP
            res.status(200).json({ 
                success: true, 
                message: response.message
            });

        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    },
    
    // 1.5 VERIFY EMAIL (Completes registration & logs in)
    async verifyEmail(req: Request, res: Response) {
        try {
            const { email, otp } = req.body;
            
            // Verify OTP and create the user in Postgres.
            // This now returns the user and generated tokens!
            const { user, accessToken, refreshToken } = await AuthService.verifyEmail(email, otp);
            
            // Bake the Refresh Token Cookie
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            res.status(201).json({
                success: true,
                message: "Email verified and user registered successfully!",
                user: { id: user.id, username: user.username, email: user.email },
                accessToken
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

            // 🍪 Bake the Refresh Token Cookie (7 Days)
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
            });

            // Send back standard user data for the React frontend state and the access token
            res.status(200).json({
                success: true,
                user: { id: user.id, username: user.username, email: user.email },
                accessToken
            });
        } catch (error: any) {
            res.status(401).json({ success: false, message: error.message });
        }
    },

    // 3. LOGOUT (The Kill Switch)
    async logout(req: Request, res: Response) {
        // Clear the cookies from the browser
        res.clearCookie('refreshToken');
        
        res.status(200).json({ success: true, message: "Logged out successfully." }); },
        
    // 4. ME (Auto-Login / Session Check)
    async me(req: Request, res: Response) {
        try {
            // Re-fetch the verified user's data from the DB so you can return it.
            // Note: Since this endpoint is protected by the requireAuth middleware,
            // req.user has already been set and validated!
            const userId = (req as any).user.id;
            
            // Assume we have a method to fetch a user by ID in AuthService
            const user = await AuthService.getUserById(userId);

            if (!user) {
                res.status(404).json({ success: false, message: "User not found" });
                return;
            }

            res.status(200).json({
                success: true,
                user: { id: user.id, username: user.username, email: user.email }
            });
        } catch (error: any) {
            res.status(401).json({ success: false, message: error.message });
        }
    }, 
    // writing a controller to handle regeneration of otp and deletion of previous one
    async resendOtp(req: Request, res: Response) {
        try {
            const { email } = req.body;
            if (!email) {
                res.status(400).json({ success: false, message: "Email is required" });
                return;
            }

            const response = await AuthService.resendOTP(email);

            res.status(200).json({
                success: true,
                message: response.message
            });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
};