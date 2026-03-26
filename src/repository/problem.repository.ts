import { prisma } from '../lib/prisma.ts'; // Update import path if using custom output

export const ProblemRepository = {
    
    async createProblemWithLanguages(problemData: any, languageConfigs: any[]) {
        // This is a Prisma "Nested Write". It is 100% atomic.
        return await prisma.problem.create({
            data: {
                id: problemData.id,
                title: problemData.title,
                description: problemData.description,
                difficulty: problemData.difficulty,
                publicTestCases: problemData.publicTestCases,
                privateTestCases: problemData.privateTestCases,
                // Automatically inserts into the ProblemLanguage table!
                languageConfigs: {
                    create: languageConfigs
                }
            },
            include: {
                // Tells Prisma to return the newly created languages in the response
                languageConfigs: true 
            }
        });
    }
};