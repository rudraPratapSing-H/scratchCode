export const WrapperService = {
    wrapCode(language: string, userCode: string, driverCode: string, testCases: any[] | any, parameterType: string[], parameterNames: string[]): string {
        if (!driverCode) return userCode;

        const parameterTypes = parameterType;
        const normalizedTestCases = Array.isArray(testCases)
            ? testCases
            : testCases !== undefined && testCases !== null
                ? [testCases]
                : [];

        // 1. Inject the user's code
        let fullCode = driverCode;
        if (fullCode.includes('{{USER_CODE}}')) {
            fullCode = fullCode.replace('{{USER_CODE}}', userCode);
        }


        // Helper function to recursively find and extract all arrays from an input object (for TreeNode/ListNode)
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

        const resolveInputValues = (testCase: any): any[] => {
            // === NEW: OPTION 2 (EXPLICIT EXTRACTION) ===
            // If we have the names, map them directly to guarantee order!
            if (parameterNames && parameterNames.length === parameterTypes.length) {
                return parameterNames.map(name => testCase?.input[name]);
            }

            // === SMART FALLBACK (For older problems missing parameterNames) ===
            let inputValues = Array.isArray(testCase?.input) ? testCase.input : (testCase?.input ? Object.values(testCase.input) : []);
            const rawValues = Object.values(testCase?.input || {});
            const matchedValues: any[] = new Array(parameterTypes.length).fill(null);
            const usedIndices = new Set<number>();

            for (let i = 0; i < parameterTypes.length; i++) {
                const expectedType = parameterTypes[i];

                for (let j = 0; j < rawValues.length; j++) {
                    if (usedIndices.has(j)) continue;

                    const val = rawValues[j];
                    let isMatch = false;

                    // Detect 2D Arrays (e.g., int[][])
                    if (expectedType.endsWith('[][]') && Array.isArray(val) && (val.length === 0 || Array.isArray(val[0]))) {
                        isMatch = true;
                    }
                    // Detect 1D Arrays (e.g., int[], String[])
                    else if (expectedType.endsWith('[]') && !expectedType.endsWith('[][]') && Array.isArray(val) && (val.length === 0 || !Array.isArray(val[0]))) {
                        isMatch = true;
                    }
                    // Detect Primitives (e.g., int, String, boolean)
                    else if (!expectedType.endsWith('[]') && !Array.isArray(val) && typeof val !== 'object') {
                        isMatch = true;
                    }
                    // Detect Objects (e.g., TreeNode, ListNode usually represented as flat arrays in JSON)
                    else if ((expectedType === 'TreeNode' || expectedType === 'ListNode') && Array.isArray(val)) {
                        isMatch = true;
                    }

                    if (isMatch) {
                        matchedValues[i] = val;
                        usedIndices.add(j);
                        break;
                    }
                }
            }

            if (matchedValues.includes(null)) {
                inputValues = rawValues;
            } else {
                inputValues = matchedValues;
            }

            if (parameterTypes.length !== inputValues.length) {
                throw new Error(`Mismatch: parameterTypes (${parameterTypes.length}) and inputValues (${inputValues.length})`);
            }

            return inputValues;
        };
        // Helper: Map a value to its Java code representation based on type
        const javaValue = (type: string, value: any): string => {
            if (value === null || value === undefined) return 'null';
            switch (type) {
                case 'int': return String(value);
                case 'long': return String(value) + 'L';
                case 'double': return String(value);
                case 'boolean': return value ? 'true' : 'false';
                case 'char': return `'${value}'`;
                case 'String': return `"${value}"`;
                case 'int[]': return `new int[]{${value.join(',')}}`;
                case 'long[]': return `new long[]{${value.map((v: any) => v + 'L').join(',')}}`;
                case 'double[]': return `new double[]{${value.join(',')}}`;
                case 'boolean[]': return `new boolean[]{${value.map((v: any) => v ? 'true' : 'false').join(',')}}`;
                case 'char[]': return `new char[]{${value.map((v: any) => `'${v}'`).join(',')}}`;
                case 'String[]': return `new String[]{${value.map((v: any) => `"${v}"`).join(',')}}`;
                case 'int[][]': return `new int[][]{${value.map((arr: any) => `new int[]{${arr.join(',')}}`).join(',')}}`;
                case 'String[][]': return `new String[][]{${value.map((arr: any) => `new String[]{${arr.map((v: any) => `"${v}"`).join(',')}}`).join(',')}}`;
                case 'TreeNode': {
                    // Use extractArrays for TreeNode input
                    const arrays = extractArrays(value);
                    // Assume a helper like TreeNode.fromArray exists in Java driver
                    return `TreeNode.fromArray(new Integer[]{${arrays[0].map((v: any) => v === null ? 'null' : v).join(',')}})`;
                }
                case 'ListNode': {
                    const arrays = extractArrays(value);
                    return `ListNode.fromArray(new Integer[]{${arrays[0].map((v: any) => v === null ? 'null' : v).join(',')}})`;
                }
                // Add more as needed
                default:
                    if (type.endsWith('[]')) {
                        // Try to handle generic arrays
                        return `new ${type}{${value.map((v: any) => javaValue(type.replace('[]', ''), v)).join(',')}}`;
                    }
                    return String(value);
            }
        };

        // Helper: Map a value to its C++ code representation based on type
        const cppValue = (type: string, value: any): string => {
            if (value === null || value === undefined) return 'nullptr';
            switch (type) {
                case 'int': return String(value);
                case 'long': return String(value) + 'L';
                case 'double': return String(value);
                case 'boolean': return value ? 'true' : 'false';
                case 'char': return `'${value}'`;
                case 'String': return `"${value}"`;
                case 'int[]': return `{${value.join(', ')}}`;
                case 'long[]': return `{${value.map((v: any) => v + 'L').join(', ')}}`;
                case 'double[]': return `{${value.join(', ')}}`;
                case 'boolean[]': return `{${value.map((v: any) => v ? 'true' : 'false').join(', ')}}`;
                case 'char[]': return `{${value.map((v: any) => `'${v}'`).join(', ')}}`;
                case 'String[]':
                    return `{${value.map((v: any) => cppValue(type.replace('[]', ''), v)).join(', ')}}`;
                case 'int[][]': return `{${value.map((arr: any) => `{${arr.join(', ')}}`).join(', ')}}`;
                case 'String[][]':
                    return `{${value.map((arr: any) => cppValue(type.replace('[]', ''), arr)).join(', ')}}`;
                case 'TreeNode': {
                    // Use extractArrays for TreeNode input
                    const arrays = extractArrays(value);
                    // Assume a helper like TreeNode({1,2,3}) exists in C++ driver
                    return `TreeNode(${arrays[0].map((v: any) => v === null ? 'nullptr' : v).join(', ')})`;
                }
                case 'ListNode': {
                    const arrays = extractArrays(value);
                    return `ListNode(${arrays[0].map((v: any) => v === null ? 'nullptr' : v).join(', ')})`;
                }
                // Add more as needed
                default:
                    if (type.endsWith('[]')) {
                        return `{${value.map((v: any) => cppValue(type.replace('[]', ''), v)).join(', ')}}`;
                    }
                    return String(value);
            }
        };

        const pythonValue = (value: any): string => {
            if (value === null || value === undefined) return 'None';
            if (Array.isArray(value)) {
                return `[${value.map((item) => pythonValue(item)).join(', ')}]`;
            }
            if (typeof value === 'object') {
                return `{${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}: ${pythonValue(item)}`).join(', ')}}`;
            }
            if (typeof value === 'string') return JSON.stringify(value);
            if (typeof value === 'boolean') return value ? 'True' : 'False';
            return String(value);
        };

        const buildSingleTestCaseLiteral = (testCase: any): string => {
            const expectedOut = String(testCase?.expectedOutput ?? testCase?.expected ?? '');
            const inputValues = resolveInputValues(testCase);

            if (language === 'cpp') {
                const cppInputs = parameterTypes.map((type: string, idx: number) => cppValue(type, inputValues[idx]));
                return `TestCase(${cppInputs.join(', ')}, ${JSON.stringify(expectedOut)})`;
            }

            if (language === 'java') {
                const javaInputs = parameterTypes.map((type: string, idx: number) => javaValue(type, inputValues[idx]));
                return `new TestCase(${javaInputs.join(', ')}, ${JSON.stringify(expectedOut)})`;
            }

            if (language === 'python') {
                return pythonValue(testCase);
            }

            return JSON.stringify(testCase);
        };

        const buildTestCaseCollectionLiteral = (cases: any[]): string => {
            const literals = cases.map((item) => buildSingleTestCaseLiteral(item));

            if (language === 'cpp') {
                return `std::vector<TestCase>{${literals.join(', ')}}`;
            }

            if (language === 'java') {
                return `new TestCase[]{${literals.join(', ')}}`;
            }

            if (language === 'python') {
                return `[${literals.join(', ')}]`;
            }

            return `[${literals.join(', ')}]`;
        };

        // 2. Inject one or many test cases.
        if (fullCode.includes('{{TEST_CASE}}') || fullCode.includes('{{TEST_CASES}}')) {
            if (fullCode.includes('{{TEST_CASE}}')) {
                fullCode = fullCode.replace('{{TEST_CASE}}', buildSingleTestCaseLiteral(normalizedTestCases[0]));
            }

            if (fullCode.includes('{{TEST_CASES}}')) {
                fullCode = fullCode.replace('{{TEST_CASES}}', buildTestCaseCollectionLiteral(normalizedTestCases));
            }
        }

        return fullCode;
    }
};