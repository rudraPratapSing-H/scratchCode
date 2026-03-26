import 'dotenv/config';
import generatedPrisma from '../../generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';

const { PrismaClient } = generatedPrisma as any;

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error('Missing DIRECT_URL or DATABASE_URL environment variable for Prisma connection.');
}

const adapter = new PrismaPg({ connectionString });

// This guarantees we only ever have ONE connection pool to the database
export const prisma = new PrismaClient({ adapter });