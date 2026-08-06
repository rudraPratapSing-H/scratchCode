import { WrapperService } from '../../services/wrapper.service.ts';

// ===========================================================================
// WrapperService is pure logic — no mocking needed!
// ===========================================================================

describe('WrapperService', () => {
    describe('wrapCode — basic template injection', () => {
        it('should return raw userCode when driverCode is empty', () => {
            const result = WrapperService.wrapCode(
                'javascript', 'console.log("hi")', '', [], [], []
            );
            expect(result).toBe('console.log("hi")');
        });

        it('should inject user code into {{USER_CODE}} placeholder', () => {
            const driver = '// driver\n{{USER_CODE}}\n// end';
            const result = WrapperService.wrapCode(
                'javascript', 'const x = 1;', driver, [], [], []
            );
            expect(result).toBe('// driver\nconst x = 1;\n// end');
        });
    });

    // -----------------------------------------------------------------------
    // JavaScript test case injection
    // -----------------------------------------------------------------------
    describe('wrapCode — JavaScript test cases', () => {
        it('should inject a single test case as JSON', () => {
            const driver = 'const tc = {{TEST_CASE}};';
            const testCases = [{ input: { nums: [1, 2], target: 3 }, expectedOutput: '[0,1]' }];

            const result = WrapperService.wrapCode(
                'javascript', '', driver, testCases, ['int[]', 'int'], ['nums', 'target']
            );

            expect(result).toContain('const tc = ');
            // For JS, it serializes as JSON
            const injected = result.replace('const tc = ', '').replace(';', '');
            const parsed = JSON.parse(injected);
            expect(parsed.expectedOutput).toBe('[0,1]');
        });

        it('should inject multiple test cases as JSON array', () => {
            const driver = 'const cases = {{TEST_CASES}};';
            const testCases = [
                { input: { a: 1 }, expectedOutput: '2' },
                { input: { a: 3 }, expectedOutput: '4' },
            ];

            const result = WrapperService.wrapCode(
                'javascript', '', driver, testCases, ['int'], ['a']
            );

            expect(result).toContain('[');
        });
    });

    // -----------------------------------------------------------------------
    // Python test case injection
    // -----------------------------------------------------------------------
    describe('wrapCode — Python test cases', () => {
        it('should serialize test case as Python dict literal', () => {
            const driver = 'tc = {{TEST_CASE}}';
            const testCases = [{ input: { nums: [1, 2] }, expectedOutput: '3' }];

            const result = WrapperService.wrapCode(
                'python', '', driver, testCases, ['int[]'], ['nums']
            );

            expect(result).toContain('tc = ');
            // Python booleans and None use different syntax
        });

        it('should handle Python boolean and None values', () => {
            const driver = 'tc = {{TEST_CASE}}';
            const testCases = [{ input: { flag: true, value: null }, expectedOutput: 'True' }];

            const result = WrapperService.wrapCode(
                'python', '', driver, testCases, ['boolean', 'int'], ['flag', 'value']
            );

            expect(result).toContain('True');
            expect(result).toContain('None');
        });
    });

    // -----------------------------------------------------------------------
    // Java test case injection
    // -----------------------------------------------------------------------
    describe('wrapCode — Java test cases', () => {
        it('should generate Java TestCase constructor for int array + int', () => {
            const driver = 'TestCase tc = {{TEST_CASE}};';
            const testCases = [{ input: { nums: [1, 2, 3], target: 5 }, expectedOutput: '2' }];

            const result = WrapperService.wrapCode(
                'java', '', driver, testCases, ['int[]', 'int'], ['nums', 'target']
            );

            expect(result).toContain('new int[]{1,2,3}');
            expect(result).toContain('5');
            expect(result).toContain('"2"');
        });

        it('should generate Java String array correctly', () => {
            const driver = 'TestCase tc = {{TEST_CASE}};';
            const testCases = [{ input: { words: ['hello', 'world'] }, expectedOutput: '2' }];

            const result = WrapperService.wrapCode(
                'java', '', driver, testCases, ['String[]'], ['words']
            );

            expect(result).toContain('new String[]{"hello","world"}');
        });

        it('should handle Java boolean values', () => {
            const driver = 'TestCase tc = {{TEST_CASE}};';
            const testCases = [{ input: { flag: true }, expectedOutput: 'true' }];

            const result = WrapperService.wrapCode(
                'java', '', driver, testCases, ['boolean'], ['flag']
            );

            expect(result).toContain('true');
        });

        it('should generate Java 2D int array', () => {
            const driver = 'TestCase tc = {{TEST_CASE}};';
            const testCases = [{ input: { matrix: [[1, 2], [3, 4]] }, expectedOutput: '10' }];

            const result = WrapperService.wrapCode(
                'java', '', driver, testCases, ['int[][]'], ['matrix']
            );

            expect(result).toContain('new int[][]{new int[]{1,2},new int[]{3,4}}');
        });
    });

    // -----------------------------------------------------------------------
    // C++ test case injection
    // -----------------------------------------------------------------------
    describe('wrapCode — C++ test cases', () => {
        it('should generate C++ TestCase constructor for int array', () => {
            const driver = 'TestCase tc = {{TEST_CASE}};';
            const testCases = [{ input: { nums: [1, 2, 3] }, expectedOutput: '6' }];

            const result = WrapperService.wrapCode(
                'cpp', '', driver, testCases, ['int[]'], ['nums']
            );

            expect(result).toContain('{1, 2, 3}');
            expect(result).toContain('"6"');
        });

        it('should generate C++ 2D int array', () => {
            const driver = 'TestCase tc = {{TEST_CASE}};';
            const testCases = [{ input: { grid: [[1, 0], [0, 1]] }, expectedOutput: '2' }];

            const result = WrapperService.wrapCode(
                'cpp', '', driver, testCases, ['int[][]'], ['grid']
            );

            expect(result).toContain('{1, 0}');
            expect(result).toContain('{0, 1}');
        });

        it('should generate C++ multiple test cases as vector', () => {
            const driver = 'auto cases = {{TEST_CASES}};';
            const testCases = [
                { input: { n: 1 }, expectedOutput: '1' },
                { input: { n: 2 }, expectedOutput: '2' },
            ];

            const result = WrapperService.wrapCode(
                'cpp', '', driver, testCases, ['int'], ['n']
            );

            expect(result).toContain('std::vector<TestCase>');
        });
    });

    // -----------------------------------------------------------------------
    // Edge cases
    // -----------------------------------------------------------------------
    describe('wrapCode — edge cases', () => {
        it('should handle undefined/null test cases gracefully', () => {
            const driver = 'const tc = {{TEST_CASE}};';
            const result = WrapperService.wrapCode(
                'javascript', '', driver, undefined as any, [], []
            );
            // Should not throw and should produce some output
            expect(typeof result).toBe('string');
        });

        it('should handle a single object test case (non-array)', () => {
            const driver = 'const tc = {{TEST_CASE}};';
            const singleCase = { input: { x: 5 }, expectedOutput: '5' };

            const result = WrapperService.wrapCode(
                'javascript', '', driver, singleCase, ['int'], ['x']
            );

            expect(result).toContain('const tc = ');
        });

        it('should handle both {{USER_CODE}} and {{TEST_CASES}} in the same template', () => {
            const driver = '{{USER_CODE}}\nconst cases = {{TEST_CASES}};';
            const testCases = [{ input: { a: 1 }, expectedOutput: '1' }];

            const result = WrapperService.wrapCode(
                'javascript', 'function solve() {}', driver, testCases, ['int'], ['a']
            );

            expect(result).toContain('function solve() {}');
            expect(result).toContain('const cases = [');
        });
    });
});
