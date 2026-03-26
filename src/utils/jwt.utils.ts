import jwt from 'jsonwebtoken';

export const JwtUtil = {
    // Generate a token
    generateToken(payload: object, expiresIn: any): string {
        return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn });
    },

    // Verify a token
    verifyToken(token: string): any {
        return jwt.verify(token, process.env.JWT_SECRET as string);
    }
};