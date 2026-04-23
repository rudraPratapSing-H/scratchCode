export const WrapperService = {
    wrapCode(language: string, userCode: string, driverCode: string, testCase: any, parameterType: string[]): string {
        if (!driverCode) return userCode;

        // 1. Inject the user's code
        let parameterTypes = parameterType;
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
                case 'long':return String(value) + 'L';
                case 'double': return String(value);
                case 'boolean': return value ? 'true' : 'false';
                case 'char': return `'${value}'`;
                case 'String': return `"${value}"`;
                case 'int[]': return `{${value.join(', ')}}`;
                case 'long[]': return `{${value.map((v: any) => v + 'L').join(', ')}}`;
                case 'double[]': return `{${value.join(', ')}}`;
                case 'boolean[]':return `{${value.map((v: any) => v ? 'true' : 'false').join(', ')}}`;
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

        // 2. Inject one test case. We keep TEST_CASES for backward compatibility.
        if (fullCode.includes('{{TEST_CASE}}') || fullCode.includes('{{TEST_CASES}}')) {
            let testCaseString = '';
            const expectedOut = String(testCase?.expectedOutput ?? '');
           
            
            console.log('Parameter Types:', parameterTypes);
            console.log('Test Case Input:', testCase?.input);
            const inputValues = Array.isArray(testCase?.input) ? testCase.input : (testCase?.input ? Object.values(testCase.input) : []);
            if (parameterTypes.length !== inputValues.length) {
                throw new Error(`Mismatch: parameterTypes (${parameterTypes.length}) and inputValues (${inputValues.length})`);
            }
            if (language === 'cpp') {
                // Map each input to its C++ representation
                
                const cppInputs = parameterTypes.map((type: string, idx: number) => cppValue(type, inputValues[idx]));
                testCaseString = `{ ${cppInputs.join(', ')}, "${expectedOut}" }`;
            } else if (language === 'java') {
                // Map each input to its Java representation
                const javaInputs = parameterTypes.map((type: string, idx: number) => javaValue(type, inputValues[idx]));
                testCaseString = `new TestCase(${javaInputs.join(', ')}, "${expectedOut}")`;
            } else {
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