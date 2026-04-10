type PublicCaseDetail = {
    testCase: number;
    testCaseData: any;
    input: any;
    output: string;
    expectedOutput: string;
    passed: boolean;
};

type GradingResult = {
    status: string;
    details?: PublicCaseDetail[];
};

export const GradingService = {
    evaluateOutput(actualOutput: string, testCases: any[], isPublicTestCase: boolean = false): GradingResult {
        const normalizedOutput = String(actualOutput || '').trim();

        const userAnswers = normalizedOutput.split('\n');
        const publicDetails: PublicCaseDetail[] = [];
        
        // Loop through the JSONB test cases from the database
        for (let i = 0; i < testCases.length; i++) {
            const expected =  String(testCases[i]?.expectedOutput ?? '').trim();
            const actual = userAnswers[i] === undefined ? '' : String(userAnswers[i]).trim();
            const passed = userAnswers[i] !== undefined && actual === expected;

            if (isPublicTestCase) {
                publicDetails.push({
                    testCase: i + 1,
                    testCaseData: testCases[i],
                    input: testCases[i]?.input,
                    output: actual,
                    expectedOutput: expected,
                    passed
                });
            }

            // Handle cases where the user's code crashed before finishing all tests
            if (userAnswers[i] === undefined) {
                return {
                    status: `Wrong Answer on Test Case ${i + 1}`,
                    details: isPublicTestCase ? publicDetails : undefined
                };
            }

            if (!passed) {
                return {
                    status: `Wrong Answer on Test Case ${i + 1} \n(Expected: ${expected}, Got: ${actual})`,
                    details: isPublicTestCase ? publicDetails : undefined
                };
            }
        }

        return {
            status: 'Accepted',
            details: isPublicTestCase ? publicDetails : undefined
        };
    },

    mapSystemError(errorMessage: string): string {
        if (errorMessage === "Time Limit Exceeded") return "Time Limit Exceeded";
        if (errorMessage.includes("Killed") || errorMessage.includes("OOM")) return "Memory Limit Exceeded";
        return "Runtime Error"; 
    }
};