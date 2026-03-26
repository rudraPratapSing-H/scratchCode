import { ProblemRepository } from '../repository/problem.repository.ts';   

export const createNewProblem = async (data: any) => {
    // 1. Business Logic Validation
    if (!data.title || !data.description) {
        throw new Error("Title and description are required.");
    }
    if (!data.languageConfigs || data.languageConfigs.length === 0) {
        throw new Error("A problem must have at least one language configuration.");
    }

    // 2. Auto-generate a slugified ID based on the title
    const id = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    // 3. Pass to the Repository
    return await ProblemRepository.createProblemWithLanguages(
        { ...data, id }, 
        data.languageConfigs
    );
};