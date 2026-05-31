import { OrganizationRepository } from '../repository/organization.repository.ts';

export const OrganizationService = {
    async createOrganization(name: string) {
        const normalizedName = String(name || '').trim();

        if (!normalizedName) {
            throw new Error('Organization name is required.');
        }

        const existingOrganization = await OrganizationRepository.findOrganizationByName(normalizedName);
        if (existingOrganization) {
            throw new Error('An organization with this name already exists.');
        }

        return await OrganizationRepository.createOrganization(normalizedName);
    }
};