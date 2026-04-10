export const WrapperService = {
    wrapCode(language: string, userCode: string, driverCode: string, testCases: any[]): string {
        if (!driverCode) return userCode;

        // 1. Inject the user's code
        
        let fullCode = driverCode;
        if (fullCode.includes('{{USER_CODE}}')) {
            fullCode = fullCode.replace('{{USER_CODE}}', userCode);
        }

        // 2. Inject the test cases
        if (fullCode.includes('{{TEST_CASES}}')) {
            let testCasesString = '';

            if (language === 'cpp') {
                // Map the JSON array into a C++ initializer list syntax
                // Example Output: { {0, 1, 0, 2}, "6" }
                const cppCases = testCases.map(tc => {
                    const heightStr = tc.height.join(', ');
                    return `{ {${heightStr}}, "${tc.expectedOutput}" }`;
                });
                
                // Join all cases with a comma and a newline for clean formatting
                testCasesString = cppCases.join(',\n        ');
            } 
            else if (language === 'java') {
                // Format for Java: new TestCase(new int[]{0, 1, 0, 2}, "6")
                const javaCases = testCases.map(tc => {
                    const heightStr = tc.height.join(', ');
                    return `new TestCase(new int[]{${heightStr}}, "${tc.expectedOutput}")`;
                });
                testCasesString = javaCases.join(',\n            ');
            }
            else {
                // For Python, JS, TypeScript, standard JSON works perfectly
                testCasesString = JSON.stringify(testCases);
            }

            fullCode = fullCode.replace('{{TEST_CASES}}', testCasesString);
        }

        return fullCode;
    }
};