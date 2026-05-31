import express from 'express';
import { OrganizationService } from '../services/organization.service.ts';

type Request = express.Request;
type Response = express.Response;

export const OrganizationController = {
    async addOrganization(req: Request, res: Response) {
        try {
            const { name } = req.body;

            const organization = await OrganizationService.createOrganization(name);

            return res.status(201).json({
                success: true,
                message: 'Organization created successfully.',
                data: organization
            });
        } catch (error: any) {
            if (error?.code === 'P2002') {
                return res.status(409).json({
                    success: false,
                    message: 'An organization with this name already exists.'
                });
            }

            return res.status(400).json({
                success: false,
                message: error?.message || 'Failed to create organization.'
            });
        }
    }
};