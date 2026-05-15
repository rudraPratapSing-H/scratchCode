/* A service layer to get the latest submission from the submission repository
 for providing it to a controller */


import { SubmissionsRepository } from "../../repository/submissions.repository.ts";



export const LatestSubmissionService = {
    async getLatestSubmissionForProblemAndUser(problemId: string, userId: string, language: string) {
        return await SubmissionsRepository.getLatestSubmission(problemId, userId, language);
    }
}   

export const AllSubmissionsService = {
    async getAllSubmissionsForProblemAndUser(problemId: string, userId: string, language: string) {
        return await SubmissionsRepository.getAllSubmissions(problemId, userId, language);
    }
}

// to fetch all submission for a user for all the alanguages 
export const AllSubmissionsForUserService = {
    async getAllSubmissionsForUser(userId: string) {
        return await SubmissionsRepository.getAllSubmissionsForUser(userId);
    }   
}

// to fetch total no of accepted problems for a user for all languages and a specific difficulty level 

export const UniqueProblemsForUserService = {
    async getUniqueProblemsForUser(userId: string, difficulty: "EASY" | "MEDIUM" | "HARD") {
        return await SubmissionsRepository.getUniqueEasyProblemsForUser(userId, difficulty);
    }   

}

// to fetch total no of accepted problems for a user for all languages and all difficulty levels

export const TotalAcceptedProblemsForUserService = {
    async getAllAcceptedProblemsForUser(userId: string) {
        return await SubmissionsRepository.getAllAcceptedProblemsForUser(userId);
    }   
}

export const getAllSubmissionsForUser = {   
    async getAllSubmissionsForUser(userId: string) {
        return await SubmissionsRepository.getAllSubmissionsForUser(userId);
    }
}

