export const WrapperService = {
    wrapCode(language: string, userCode: string, driverCode: string, testCase: any): string {
        if (!driverCode) return userCode;

        // 1. Inject the user's code
        
        let fullCode = driverCode;
        if (fullCode.includes('{{USER_CODE}}')) {
            fullCode = fullCode.replace('{{USER_CODE}}', userCode);
        }

        // 2. Inject one test case. We keep TEST_CASES for backward compatibility.
        if (fullCode.includes('{{TEST_CASE}}') || fullCode.includes('{{TEST_CASES}}')) {
            let testCaseString = '';

            if (language === 'cpp') {
                // Keep the old shape expected by existing C++ driver templates.
                const heightStr = Array.isArray(testCase?.height) ? testCase.height.join(', ') : '';
                testCaseString = `{ {${heightStr}}, "${String(testCase?.expectedOutput ?? '')}" }`;
            } 
            else if (language === 'java') {
                // Keep the old shape expected by existing Java driver templates.
                const heightStr = Array.isArray(testCase?.height) ? testCase.height.join(', ') : '';
                testCaseString = `new TestCase(new int[]{${heightStr}}, "${String(testCase?.expectedOutput ?? '')}")`;
            }
            else {
                // For Python/JS/TS, inject a single JSON test case object.
                testCaseString = JSON.stringify(testCase);
            }

            if (fullCode.includes('{{TEST_CASE}}')) {
                fullCode = fullCode.replace('{{TEST_CASE}}', testCaseString);
            }

            if (fullCode.includes('{{TEST_CASES}}')) {
                // Backward compatibility: old templates expect an array.
                fullCode = fullCode.replace('{{TEST_CASES}}', JSON.stringify([testCase]));
            }
        }

        return fullCode;
    }
};