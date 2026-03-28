export const WrapperService = {
    wrapCode(language: string, userCode: string, boilerplate: string, testCases: any): string {
        if (!boilerplate) return userCode;

        // 1. Inject the user's code
        let fullCode = boilerplate;
        if (fullCode.includes('{{USER_CODE}}')) {
            fullCode = fullCode.replace('{{USER_CODE}}', userCode);
        }

        // 2. Inject the JSONB test cases directly into the code!
        if (fullCode.includes('{{TEST_CASES}}')) {
            // Stringify the JSONB array so it becomes a valid JS/Python array in the code
            const testCasesString = JSON.stringify(testCases);
            fullCode = fullCode.replace('{{TEST_CASES}}', testCasesString);
        }

        return fullCode;
    }
};