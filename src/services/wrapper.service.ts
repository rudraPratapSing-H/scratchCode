export const WrapperService = {
    wrapCode(language: string, userCode: string, driverCode: string, testCase: any): string {
        if (!driverCode) return userCode;

        // 1. Inject the user's code
        
        let fullCode = driverCode;
        if (fullCode.includes('{{USER_CODE}}')) {
            fullCode = fullCode.replace('{{USER_CODE}}', userCode);
        }

        // 2. Inject one test case. We keep TEST_CASES for backward compatibility.
        // Helper function to recursively find and extract all arrays from an input object
        const extractArrays = (obj: any): any[][] => {
            if (obj === null || obj === undefined) return [];
            if (Array.isArray(obj)) return [obj];
            if (typeof obj === 'object') {
                // Recursively extract from all values in the object/dictionary
                return Object.values(obj).flatMap(val => extractArrays(val));
            }
            // Fallback for single primitives, treating them as single-item arrays
            // Adjust this if your driver templates expect raw primitives instead of arrays
            return [[obj]];
        };

        // 2. Inject one test case. We keep TEST_CASES for backward compatibility.
        if (fullCode.includes('{{TEST_CASE}}') || fullCode.includes('{{TEST_CASES}}')) {
            let testCaseString = '';

            const expectedOut = String(testCase?.expectedOutput ?? '');

            if (language === 'cpp') {
                const arrays = extractArrays(testCase?.input);
                
                // Map each array to a C++ initializer string: { "val1", "val2" }
                const cppInputs = arrays.map(arr => {
                    const elements = arr.map(val => val === null ? '"null"' : `"${val}"`).join(', ');
                    return `{${elements}}`;
                });
                
                // Join all array initializers together
                testCaseString = `{ ${cppInputs.join(', ')}, "${expectedOut}" }`;
            } 
            else if (language === 'java') {
                const arrays = extractArrays(testCase?.input);
                
                // Map each array to a Java array initialization: new Integer[]{ val1, val2 }
                const javaInputs = arrays.map(arr => {
                    const elements = arr.map(val => val === null ? 'null' : val).join(', ');
                    return `new Integer[]{${elements}}`;
                });
                
                // Pass them all dynamically as arguments to TestCase
                testCaseString = `new TestCase(${javaInputs.join(', ')}, "${expectedOut}")`;
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