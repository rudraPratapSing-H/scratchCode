import { jest } from '@jest/globals';

const mockWorkerService = {
    getJobDetails: jest.fn(),
    updateStatus: jest.fn()
};
const mockDockerService = {
    executeContainer: jest.fn()
};
const mockGradingService = {
    evaluateOutput: jest.fn(),
    evaluateSingleCase: jest.fn(),
    mapSystemError: jest.fn()
};
const mockWrapperService = {
    wrapCode: jest.fn()
};

jest.unstable_mockModule('../../services/worker.service.ts', () => ({ WorkerService: mockWorkerService }));
jest.unstable_mockModule('../../services/docker.service.ts', () => ({ DockerService: mockDockerService }));
jest.unstable_mockModule('../../services/grading.service.ts', () => ({ GradingService: mockGradingService }));
jest.unstable_mockModule('../../services/wrapper.service.ts', () => ({ WrapperService: mockWrapperService }));

describe('BullMQ Worker Processor', () => {
    it('should process a job successfully', async () => {
        const { processSubmissionJob } = await import('../../worker/processor.ts');

        const mockJob = {
            id: '123',
            data: { submissionId: 'sub-1', isPublicRun: true, selectedTestCases: [] }
        } as any;

        mockWorkerService.getJobDetails.mockResolvedValue({
            submission: { problem: { publicTestCases: [{ expectedOutput: 'output' }] }, language: 'python', code: 'print(\"output\")' },
            config: { driverCode: '', memoryLimit: 128, timeLimit: 2 }
        } as any);

        mockWrapperService.wrapCode.mockReturnValue('print(\"output\")');
        mockDockerService.executeContainer.mockResolvedValue({ stdout: 'output\n' } as any);
        
        mockGradingService.evaluateOutput.mockReturnValue({ status: 'Accepted', details: [] } as any);
        mockGradingService.evaluateSingleCase.mockReturnValue({ passed: true } as any);

        await processSubmissionJob(mockJob);

        expect(mockWorkerService.updateStatus).toHaveBeenCalledWith('sub-1', 'Running');
        expect(mockDockerService.executeContainer).toHaveBeenCalled();
        expect(mockWorkerService.updateStatus).toHaveBeenCalledWith('sub-1', 'Accepted', expect.any(Object));
    });
});
