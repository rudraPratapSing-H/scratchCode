/**
 * Groups problems by their questionTypes
 * Each problem can have multiple questionTypes, so it will appear in multiple groups
 * Problems with null/undefined questionTypes are grouped under "unknown"
 * 
 * @param problems - Array of problem objects from the database
 * @returns Object with questionTypes as keys and arrays of problems as values
 * 
 * Example output:
 * {
 *   "algorithm": [{ id: "two-sum", title: "Two Sum", questionTypes: ["algorithm"] }, ...],
 *   "data-structure": [{ id: "array-basics", title: "Array Basics", questionTypes: ["data-structure", "algorithm"] }, ...],
 *   "unknown": [{ id: "problem-x", title: "Problem X", questionTypes: null }, ...]
 * }
 */
export const groupProblemsByQuestionType = (problems: any[]): Record<string, any[]> => {
    const grouped: Record<string, any[]> = {};

    problems.forEach((problem) => {
        // If questionTypes is empty or undefined, add to "unknown" group
        if (!problem.questionTypes || problem.questionTypes.length === 0) {
            if (!grouped["unknown"]) {
                grouped["unknown"] = [];
            }
            grouped["unknown"].push(problem);
            return;
        }

        // For each questionType in the problem's questionTypes array,
        // add this problem to that group
        problem.questionTypes.forEach((questionType: string) => {
            if (!grouped[questionType]) {
                grouped[questionType] = [];
            }
            grouped[questionType].push(problem);
        });
    });

    return grouped;
};

/**
 * Alternative: Groups problems by questionType and also includes statistics
 * Problems with null/undefined questionTypes are grouped under "unknown"
 * 
 * @param problems - Array of problem objects from the database
 * @returns Object with questionTypes as keys and objects containing problems array and count
 */
export const groupProblemsByQuestionTypeWithStats = (problems: any[]): Record<string, { count: number; problems: any[] }> => {
    const grouped: Record<string, { count: number; problems: any[] }> = {};

    problems.forEach((problem) => {
        // If questionTypes is empty or undefined, add to "unknown" group
        if (!problem.questionTypes || problem.questionTypes.length === 0) {
            if (!grouped["unknown"]) {
                grouped["unknown"] = { count: 0, problems: [] };
            }
            grouped["unknown"].problems.push(problem);
            grouped["unknown"].count = grouped["unknown"].problems.length;
            return;
        }

        // For each questionType in the problem's questionTypes array,
        // add this problem to that group
        problem.questionTypes.forEach((questionType: string) => {
            if (!grouped[questionType]) {
                grouped[questionType] = { count: 0, problems: [] };
            }
            grouped[questionType].problems.push(problem);
            grouped[questionType].count = grouped[questionType].problems.length;
        });
    });

    return grouped;
};