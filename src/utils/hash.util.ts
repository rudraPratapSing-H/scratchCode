import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export const HashUtil = {
    // Generate a salt and hash the password
    async hashPassword(password: string): Promise<{ hash: string, salt: string }> {
        const salt = await bcrypt.genSalt(SALT_ROUNDS);
        const hash = await bcrypt.hash(password, salt);
        return { hash, salt };
    },

    // Compare a plain text password to a hash
    async compare(password: string, hash: string): Promise<boolean> {
        return await bcrypt.compare(password, hash);
    }
};