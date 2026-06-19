import express from 'express';
import { CompetitionService } from '../services/competition.service.ts';

type Request = express.Request;
type Response = express.Response;

// Strip trailing 'Z' so the frontend treats the timestamp as local time
const toLocal = (d: Date | string) => d instanceof Date ? d.toISOString().replace('Z', '') : String(d).replace('Z', '');

export async function getCompetitionProblemTitles(req: Request, res: Response) {
    try {
        const competitionId = req.params.competitionId as string;
        if (!competitionId) {
            return res.status(400).json({ success: false, message: 'competitionId parameter is required' });
        }
        const titles = await CompetitionService.getCompetitionProblemTitles(competitionId);
        return res.status(200).json({ success: true, data: titles });
    } catch (error: any) {
        console.error('Get competition problem titles error', error?.message ?? error);
        if (error?.message === 'Competition not found') {
            return res.status(404).json({ success: false, message: error.message });
        }
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

export async function getAllCompetitionsBasicInfo(req: Request, res: Response) {
    try {
        const organizationId = req.query.organizationId as string;
        if (!organizationId) {
            return res.status(400).json({ success: false, message: 'organizationId query parameter is required' });
        }
        const competitions = await CompetitionService.getAllCompetitionTitlesAndIds(organizationId);
        const mapped = competitions.map((c: any) => ({
            ...c,
            startTime: toLocal(c.startTime),
            endTime: toLocal(c.endTime)
        }));
        return res.status(200).json({ success: true, data: mapped });
    } catch (error: any) {
        console.error('Get all competitions error', error?.message ?? error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

export async function createCompetition(req: Request, res: Response) {
    try {
        const result = await CompetitionService.createCompetition(req.body);

        return res.status(201).json({ success: true, competition: result });
    } catch (error: any) {
        console.error('Create competition error', error?.message ?? error);

        if (error?.message === 'title, startTime and endTime are required' || error?.message === 'Invalid startTime or endTime' || error?.message === 'One or more problemIds are invalid') {
            return res.status(400).json({ success: false, message: error.message });
        }

        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

export async function registerForCompetition(req: Request, res: Response) {
    try {
        const competitionId = Array.isArray(req.params.competitionId)
            ? req.params.competitionId[0]
            : req.params.competitionId;
        const authUser = (req as any).user;
        const result = await CompetitionService.registerParticipant(competitionId, authUser?.id);

        if (result.alreadyRegistered) {
            return res.status(200).json({
                success: true,
                message: 'Already registered for this competition',
                participant: result.participant,
                fullScreenMandatory: result.fullScreenMandatory,
                startTime: toLocal(result.startTime),
                endTime: toLocal(result.endTime),
                finished: result.finished
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Registered for competition successfully',
            participant: result.participant,
            fullScreenMandatory: result.fullScreenMandatory,
            startTime: toLocal(result.startTime),
            endTime: toLocal(result.endTime),
            finished: result.finished
        });
    } catch (error: any) {
        console.error('Register competition participant error', error?.message ?? error);

        if (error?.message === 'competitionId is required') {
            return res.status(400).json({ success: false, message: error.message });
        }

        if (error?.message === 'Unauthorized') {
            return res.status(401).json({ success: false, message: error.message });
        }

        if (error?.message === 'Competition not found') {
            return res.status(404).json({ success: false, message: error.message });
        }

        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

export async function finishCompetition(req: Request, res: Response) {
    try {
        const competitionId = Array.isArray(req.params.competitionId)
            ? req.params.competitionId[0]
            : req.params.competitionId;
        const authUser = (req as any).user;
        
        await CompetitionService.finishCompetition(competitionId, authUser?.id);

        return res.status(200).json({
            success: true,
            message: 'Competition finished successfully'
        });
    } catch (error: any) {
        console.error('Finish competition error', error?.message ?? error);
        if (error?.message === 'competitionId is required') return res.status(400).json({ success: false, message: error.message });
        if (error?.message === 'Unauthorized') return res.status(401).json({ success: false, message: error.message });
        if (error?.message === 'Participant not found') return res.status(404).json({ success: false, message: error.message });
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

export async function getCompetitionLeaderboard(req: Request, res: Response) {
    try {
        const competitionId = req.params.competitionId as string;
        if (!competitionId) {
            return res.status(400).json({ success: false, message: 'competitionId parameter is required' });
        }

        const leaderboard = await CompetitionService.getLeaderboard(competitionId);
        return res.status(200).json({ success: true, data: leaderboard });
    } catch (error: any) {
        console.error('Get competition leaderboard error', error?.message ?? error);
        if (error?.message === 'Competition not found') {
            return res.status(404).json({ success: false, message: error.message });
        }
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

export async function logCheatingAttempt(req: Request, res: Response) {
    try {
        const competitionId = req.params.competitionId as string;
        const authUser = (req as any).user;
        
        if (!competitionId) {
            return res.status(400).json({ success: false, message: 'competitionId parameter is required' });
        }

        await CompetitionService.logCheatingAttempt(competitionId, authUser?.id);
        
        return res.status(200).json({ success: true, message: 'Cheating attempt logged successfully' });
    } catch (error: any) {
        console.error('Log cheating attempt error', error?.message ?? error);
        if (error?.message === 'Unauthorized') {
            return res.status(401).json({ success: false, message: error.message });
        }
        if (error?.message === 'Participant not found') {
            return res.status(404).json({ success: false, message: error.message });
        }
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

export async function getParticipantLogs(req: Request, res: Response) {
    try {
        const competitionId = req.params.competitionId as string;
        const authUser = (req as any).user;

        if (!competitionId) {
            return res.status(400).json({ success: false, message: 'competitionId parameter is required' });
        }

        const logs = await CompetitionService.getParticipantLogs(competitionId, authUser?.id);
        return res.status(200).json({ success: true, data: logs });
    } catch (error: any) {
        console.error('Get participant logs error', error?.message ?? error);
        if (error?.message === 'Unauthorized') {
            return res.status(401).json({ success: false, message: error.message });
        }
        if (error?.message === 'Participant not found') {
            return res.status(404).json({ success: false, message: error.message });
        }
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

export async function startProblemTimer(req: Request, res: Response) {
    try {
        const { competitionId, problemId } = req.params;
        const authUser = (req as any).user;
        
        await CompetitionService.startProblemTimer(competitionId, problemId, authUser?.id);
        
        return res.status(200).json({ success: true, message: 'Timer started' });
    } catch (error: any) {
        console.error('Start timer error', error?.message ?? error);
        if (error?.message === 'Unauthorized') return res.status(401).json({ success: false, message: error.message });
        if (error?.message === 'Participant or CompetitionProblem not found') return res.status(404).json({ success: false, message: error.message });
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

export async function pauseProblemTimer(req: Request, res: Response) {
    try {
        const { competitionId, problemId } = req.params;
        const authUser = (req as any).user;
        
        await CompetitionService.pauseProblemTimer(competitionId, problemId, authUser?.id);
        
        return res.status(200).json({ success: true, message: 'Timer paused' });
    } catch (error: any) {
        console.error('Pause timer error', error?.message ?? error);
        if (error?.message === 'Unauthorized') return res.status(401).json({ success: false, message: error.message });
        if (error?.message === 'Participant or CompetitionProblem not found') return res.status(404).json({ success: false, message: error.message });
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

export async function checkAdminAccess(req: Request, res: Response) {
    try {
        const authUser = (req as any).user;
        const result = await CompetitionService.checkAdminAccess(authUser?.id);
        return res.status(200).json({ success: true, ...result });
    } catch (error: any) {
        console.error('Check admin access error', error?.message ?? error);
        if (error?.message === 'Unauthorized') return res.status(401).json({ success: false, message: error.message });
        if (error?.message === 'User not found') return res.status(404).json({ success: false, message: error.message });
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

export async function getAdminParticipants(req: Request, res: Response) {
    try {
        const competitionId = req.params.competitionId as string;
        const authUser = (req as any).user;

        const participants = await CompetitionService.getAdminParticipants(competitionId, authUser?.id);
        return res.status(200).json({ success: true, data: participants });
    } catch (error: any) {
        console.error('Get admin participants error', error?.message ?? error);
        if (error?.message === 'Unauthorized') return res.status(401).json({ success: false, message: error.message });
        if (error?.message === 'Forbidden') return res.status(403).json({ success: false, message: 'You do not have admin rights.' });
        if (error?.message === 'Competition not found') return res.status(404).json({ success: false, message: error.message });
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

export async function getAdminParticipantDetail(req: Request, res: Response) {
    try {
        const { competitionId, participantId } = req.params;
        const authUser = (req as any).user;

        const detail = await CompetitionService.getAdminParticipantDetail(competitionId, participantId as string, authUser?.id);
        return res.status(200).json({ success: true, data: detail });
    } catch (error: any) {
        console.error('Get admin participant detail error', error?.message ?? error);
        if (error?.message === 'Unauthorized') return res.status(401).json({ success: false, message: error.message });
        if (error?.message === 'Forbidden') return res.status(403).json({ success: false, message: 'You do not have admin rights.' });
        if (error?.message === 'Participant not found') return res.status(404).json({ success: false, message: error.message });
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

export const CompetitionController = { createCompetition, registerForCompetition, finishCompetition, getAllCompetitionsBasicInfo, getCompetitionProblemTitles, getCompetitionLeaderboard, logCheatingAttempt, getParticipantLogs, startProblemTimer, pauseProblemTimer, checkAdminAccess, getAdminParticipants, getAdminParticipantDetail };
