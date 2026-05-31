import express from 'express';
import { ProblemAccessService, type ProblemAction } from '../services/problemAccess.service.ts';

type Request = express.Request;
type Response = express.Response;
type NextFunction = express.NextFunction;

export const checkProblemAccess = (action: ProblemAction) => async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id;

    if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    const problemId = typeof req.params.problemId === 'string' ? req.params.problemId : undefined;
    const organizationId = typeof req.body?.organizationId === 'string' || req.body?.organizationId === null
        ? req.body.organizationId
        : undefined;

    const accessResult = await ProblemAccessService.canUserPerformProblemAction(
        userId,
        action,
        problemId,
        organizationId
    );

    if (!accessResult.allowed) {
        return res.status(accessResult.statusCode).json({ success: false, message: accessResult.message });
    }

    return next();
};