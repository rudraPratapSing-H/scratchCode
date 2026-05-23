// A controller layer that thakes the object from the service layer (latestSubmition.services.ts) and sends it as a response to the client 

import { LatestSubmissionService } from "../../services/Dashboard/latestSubmission.dashboard.services.ts";
import express from 'express';
import { AllSubmissionsService } from "../../services/Dashboard/latestSubmission.dashboard.services.ts";
import { UniqueProblemsForUserService } from "../../services/Dashboard/latestSubmission.dashboard.services.ts";
import { TotalAcceptedProblemsForUserService } from "../../services/Dashboard/latestSubmission.dashboard.services.ts";
import { AllSubmissionsForUserService } from "../../services/Dashboard/latestSubmission.dashboard.services.ts";
import { UniqueAcceptedProblemsForUserService } from "../../services/Dashboard/latestSubmission.dashboard.services.ts";
import { getAllSubmissionsForUser } from "../../services/Dashboard/latestSubmission.dashboard.services.ts";
import { fetchProblemTitles } from '../../services/fetchProblemTitles.services.ts';
type Request = express.Request;
type Response = express.Response;

interface transferData {
    easy: number;
    medium: number;
    hard: number;
    totalProblems: number;
    acceptedProblems: number;
    score: number;
    submissions: any[]; // You can replace 'any' with a more specific type based on your submission data structure
}

export const LatestSubmissionController = {
    // controler to get all submissions for a problem and user and language
    async getAllSubmissions(req: Request, res: Response) {
        try {
            const { problemId } = req.params;
            const userId = req.user.id;
            const language = req.query.language as string; // Assuming language is passed as a query parameter  `
            if (!problemId || !language) {
                return res.status(400).json({ success: false, message: "problemId and language are required." });
            }
            const submissions = await AllSubmissionsService.getAllSubmissionsForProblemAndUser(problemId, userId, language);
            res.status(200).json({ success: true, submissions });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }   
    },
    async getLatestSubmission(req: Request, res: Response) {
        try {
            const { problemId } = req.params;
            const userId = req.user.id;
            const language = req.query.language as string; // Assuming language is passed as a query parameter

            if (!problemId || !language) {  
                return res.status(400).json({ success: false, message: "problemId and language are required." });
            }
             // Assuming you have user info in the request (e.g., from auth middleware)
            const latestSubmission = await LatestSubmissionService.getLatestSubmissionForProblemAndUser(problemId, userId, language);
            if (!latestSubmission) {
                return res.status(404).json({ success: false, message: "No submissions found for this problem." });
            }
            res.status(200).json({ success: true, submission: latestSubmission });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }   
    },
    // write  a controller to calc total easy, medium and hard problems solved by a user for the dashboard along with acceptance score and an array of all the submissions for the user for all the problems and languages
    async getUserDashboardData(req: Request, res: Response) {
        try {
            const userId = req.user.id;
            const easyProblems = await UniqueProblemsForUserService.getUniqueProblemsForUser(userId, "EASY");
            const mediumProblems = await UniqueProblemsForUserService.getUniqueProblemsForUser(userId, "MEDIUM");
            const hardProblems = await UniqueProblemsForUserService.getUniqueProblemsForUser(userId, "HARD");
            const totalAccepted = await TotalAcceptedProblemsForUserService.getAllAcceptedProblemsForUser(userId);
            // const uniqueAccepted = await UniqueAcceptedProblemsForUserService.getUniqueAcceptedProblemsForUser(userId);
            const allSubmissions = await AllSubmissionsForUserService.getAllSubmissionsForUser(userId);
            const totalProblemCount = await fetchProblemTitles().then(problems => problems.length);
            const totalProblemArray = await getAllSubmissionsForUser.getAllSubmissionsForUser(userId);
            const totalProblems = totalProblemArray.length;
            const uniqueProblems =  easyProblems.length + mediumProblems.length + hardProblems.length;
            const acceptedProblems = totalAccepted.length;

            const objectToTransfer: transferData = {
                easy: easyProblems.length,
                medium: mediumProblems.length,
                hard: hardProblems.length,
                totalProblems:totalProblemCount,
                acceptedProblems: uniqueProblems,
                score: totalProblems > 0 ? (acceptedProblems / totalProblems) * 100 : 0,
                submissions: allSubmissions
            };

            res.status(200).json({ success: true, data: objectToTransfer, allSubmissions });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }  
    }     

}   
