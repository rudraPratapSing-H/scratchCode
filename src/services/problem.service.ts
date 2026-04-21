import { ProblemRepository } from '../repository/problem.repository.ts';   

const FUZZY_RESULT_LIMIT = 3;
const FUZZY_SIMILARITY_THRESHOLD = 0.35;

const normalizeQuery = (query: string) => {
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
};

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

export const getProblemById = async (problemId: string) => {
    if (!problemId) {
        throw new Error('Problem ID is required.');
    }

    const problem = await ProblemRepository.findProblemById(problemId);
    if (!problem) {
        throw new Error('Problem not found.');
    }

    return problem;
};

export const searchProblemsByTitle = async (query: string) => {
    const normalizedQuery = normalizeQuery(query);
    if (!normalizedQuery) {
        throw new Error('Search query is required.');
    }

    const exactProblem = await ProblemRepository.findProblemByTitleExact(normalizedQuery);
    if (exactProblem) {
        return {
            matchType: 'exact' as const,
            results: [exactProblem]
        };
    }

    const fuzzyCandidates = await ProblemRepository.findProblemsByTitleFuzzy(
        normalizedQuery,
        FUZZY_RESULT_LIMIT,
        FUZZY_SIMILARITY_THRESHOLD
    );

    const fuzzyResults = fuzzyCandidates.filter(
        (candidate) => Number(candidate.similarityScore) >= FUZZY_SIMILARITY_THRESHOLD
    );

    return {
        matchType: 'fuzzy' as const,
        results: fuzzyResults
    };
};