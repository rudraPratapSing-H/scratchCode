import { GradingService } from '../../services/grading.service.ts';

describe('GradingService', () => {
  describe('evaluateSingleCase', () => {
    it('should correctly evaluate a passing case', () => {
      const output = 'hello world';
      const testCase = { input: '', expectedOutput: 'hello world' };
      
      const result = GradingService.evaluateSingleCase(output, testCase, 1, false);
      
      expect(result.passed).toBe(true);
      expect(result.detail?.output).toBe('hello world');
      expect(result.detail?.expectedOutput).toBe('hello world');
    });

    it('should handle trailing whitespaces gracefully', () => {
      const output = 'hello world   ';
      const testCase = { input: '', expectedOutput: 'hello world' };
      
      const result = GradingService.evaluateSingleCase(output, testCase, 1, false);
      
      expect(result.passed).toBe(true);
    });

    it('should fail when output does not match', () => {
      const output = 'hello universe';
      const testCase = { input: '', expectedOutput: 'hello world' };
      
      const result = GradingService.evaluateSingleCase(output, testCase, 1, false);
      
      expect(result.passed).toBe(false);
      expect(result.detail?.output).toBe('hello universe');
    });
  });

  describe('mapSystemError', () => {
    it('should map Docker OOM to Memory Limit Exceeded', () => {
      const error = 'OOMKilled: memory limit exceeded';
      const status = GradingService.mapSystemError(error);
      expect(status).toBe('Memory Limit Exceeded');
    });

    it('should map timeout to Time Limit Exceeded', () => {
      const error = 'Time Limit Exceeded';
      const status = GradingService.mapSystemError(error);
      expect(status).toBe('Time Limit Exceeded');
    });
  });
});
