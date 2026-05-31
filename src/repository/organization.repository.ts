import { prisma } from '../lib/prisma.ts';

export const OrganizationRepository = {
    async createOrganization(name: string) {
        return await prisma.organization.create({
            data: {
                name
            }
        });
    },

    async findOrganizationByName(name: string) {
        return await prisma.organization.findUnique({
            where: { name }
        });
    },

    async findOrganizationById(id: string) {
        return await prisma.organization.findUnique({
            where: { id }
        });
    }
};