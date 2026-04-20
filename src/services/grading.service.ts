type PublicCaseDetail = {
    testCase: number;
    testCaseData: any;
    input: any;
    output: string;
    expectedOutput: string;
    passed: boolean;
    error?: string;
};

type GradingResult = {
    status: string;
    details?: PublicCaseDetail[];
};

type SingleCaseGradingResult = {
    status: string;
    passed: boolean;
    detail?: PublicCaseDetail;
};

export const GradingService = {
    evaluateSingleCase(actualOutput: string, testCase: any, testCaseNumber: number, isPublicTestCase: boolean = false): SingleCaseGradingResult {
        const expected = String(testCase?.expectedOutput ?? '').trim();
        const actual = String(actualOutput || '').trim();
        const isExplicitRuntimeError = actual.startsWith('ERROR:');
        const passed = actual === expected;

        const detail: PublicCaseDetail | undefined = {
            testCase: testCaseNumber,
            testCaseData: testCase,
            input: testCase?.input,
            output: actual,
            expectedOutput: expected,
            passed,
            error: isExplicitRuntimeError ? actual : undefined
        };

        if (isExplicitRuntimeError) {
            return {
                status: `Runtime Error on Test Case ${testCaseNumber}`,
                passed: false,
                detail
            };
        }

        if (!passed) {
            return {
                status: `Wrong Answer on Test Case ${testCaseNumber} \n(Expected: ${expected}, Got: ${actual})`,
                passed,
                detail
            };
        }

        return {
            status: 'Accepted',
            passed,
            detail: passed ? undefined : detail
        };
    },

    evaluateOutput(actualOutput: string, testCases: any[], isPublicTestCase: boolean = false): GradingResult {
        const userAnswers = String(actualOutput || '').trim().split('\n');
        const publicDetails: PublicCaseDetail[] = [];
        
        // Loop through the JSONB test cases from the database
        for (let i = 0; i < testCases.length; i++) {
            // Handle cases where the user's code crashed before finishing all tests
            if (userAnswers[i] === undefined) {
                if (isPublicTestCase) {
                    publicDetails.push({
                        testCase: i + 1,
                        testCaseData: testCases[i],
                        input: testCases[i]?.input,
                        output: '',
                        expectedOutput: String(testCases[i]?.expectedOutput ?? '').trim(),
                        passed: false,
                        error: 'No output received for this test case.'
                    });
                }

                return {
                    status: `Wrong Answer on Test Case ${i + 1}`,
                    details: isPublicTestCase ? publicDetails : undefined
                };
            }

            const caseResult = this.evaluateSingleCase(userAnswers[i], testCases[i], i + 1, isPublicTestCase);

            if (isPublicTestCase && caseResult.detail) {
                publicDetails.push(caseResult.detail);
            }

            if (!caseResult.passed) {
                return {
                    status: caseResult.status,
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
        const message = String(errorMessage || '');
        if (message === "Time Limit Exceeded") return "Time Limit Exceeded";
        if (message.includes("Killed") || message.includes("OOM")) return "Memory Limit Exceeded";
        return errorMessage;
    }
};