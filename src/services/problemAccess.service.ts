import { ProblemRepository } from '../repository/problem.repository.ts';
import { UserRepository } from '../repository/users.repository.ts';

export type ProblemAction = 'read' | 'create' | 'update' | 'delete';

type AccessResult =
    | { allowed: true }
    | { allowed: false; statusCode: number; message: string };

export const ProblemAccessService = {
    async canUserPerformProblemAction(
        userId: string,
        action: ProblemAction,
        problemId?: string,
        organizationId?: string | null
    ): Promise<AccessResult> {
        const user = await UserRepository.findUserById(userId);

        if (!user) {
            return { allowed: false, statusCode: 404, message: 'User not found.' };
        }

        if (action === 'create') {
            if (user.role !== 'ADMIN') {
                return { allowed: false, statusCode: 403, message: 'Only admins can create problems.' };
            }

            if (!user.organizationId) {
                return { allowed: false, statusCode: 403, message: 'Admin account is not assigned to an organization.' };
            }

            if (!organizationId) {
                return { allowed: false, statusCode: 400, message: 'organizationId is required when creating a problem.' };
            }

            if (organizationId !== user.organizationId) {
                return { allowed: false, statusCode: 403, message: 'Admins can only create problems for their own organization.' };
            }

            return { allowed: true };
        }

        if (!problemId) {
            return { allowed: false, statusCode: 400, message: 'Problem ID is required.' };
        }

        const problem = await ProblemRepository.findProblemById(problemId);

        if (!problem) {
            return { allowed: false, statusCode: 404, message: 'Problem not found.' };
        }

        if (action === 'read') {
            if (user.role === 'USER') {
                return { allowed: true };
            }

            if (!user.organizationId) {
                return { allowed: false, statusCode: 403, message: 'User account is not assigned to an organization.' };
            }

            if (problem.organizationId !== user.organizationId) {
                return { allowed: false, statusCode: 403, message: 'Users can only read problems from their own organization.' };
            }
            

            return { allowed: true };
        }

        if (user.role !== 'ADMIN') {
            return { allowed: false, statusCode: 403, message: 'Only admins can modify problems.' };
        }

        if (!user.organizationId) {
            return { allowed: false, statusCode: 403, message: 'Admin account is not assigned to an organization.' };
        }

        if (problem.organizationId !== user.organizationId) {
            return { allowed: false, statusCode: 403, message: 'Admins can only modify problems from their own organization.' };
        }

        return { allowed: true };
    }
};