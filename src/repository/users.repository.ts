import { prisma } from '../lib/prisma.ts';

export const UserRepository = {
    
    findAllUsers: async () => {
        return await prisma.user.findMany();
    },

    findAllUsernames: async () => {
        return await prisma.user.findMany({
            select: { username: true } // Prisma's way of doing select('username -_id')
        });
    },

    findUserByUsername: async (username: string) => {
        // Username is no longer unique; return the first matching user if any.
        return await prisma.user.findFirst({
            where: { username }
        });
    },

    findUserById: async (id: string) => {
        return await prisma.user.findUnique({
            where: { id }
        });
    },

    getUserByEmail: async (email: string) => {
        return await prisma.user.findUnique({
            where: { email }
        });
    },

    // Infer allowed create payload directly from Prisma client method typing.
    createUser: async (values: Parameters<typeof prisma.user.create>[0]['data']) => {
        return await prisma.user.create({
            data: values
        });
    },

    // Infer allowed update payload directly from Prisma client method typing.
    updateUser: async (id: string, values: Parameters<typeof prisma.user.update>[0]['data']) => {
        return await prisma.user.update({
            where: { id },
            data: values
        });
    },

    deleteUser: async (id: string) => {
        return await prisma.user.delete({
            where: { id }
        });
    },

    findUserBySessionToken: async (sessionToken: string) => {
        // We use findFirst instead of findUnique here unless you make sessionToken @unique in the schema
        return await prisma.user.findFirst({
            where: { sessionToken }
        });
    },

    // For refresh token rotation
    findUserByRefreshToken: async (refreshToken: string) => {
        return await prisma.user.findFirst({
            where: { refreshToken }
        });
    },

    updateUserRefreshTokenByEmail: async (email: string, refreshToken: string) => {
        return await prisma.user.update({
            where: { email },
            data: { refreshToken }
        });
    }
};