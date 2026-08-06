import { Job } from 'bullmq';
import { WorkerService } from '../services/worker.service.ts';
import { WrapperService } from '../services/wrapper.service.ts';
import { DockerService } from '../services/docker.service.ts';
import { GradingService } from '../services/grading.service.ts';

const normalizeTestCase = (testCase: any) => ({
    ...testCase,
    expectedOutput: testCase?.expectedOutput ?? testCase?.expected ?? '',
    input: testCase?.input ?? testCase?.testCaseData?.input ?? testCase?.testCaseData ?? ''
});

export const processSubmissionJob = async (job: Job) => {
    const { submissionId, isPublicRun, selectedTestCases } = job.data;

    try {
        console.log('[WORKER] Job received');
        const { submission, config } = await WorkerService.getJobDetails(submissionId);
        const baseTestCases = isPublicRun ? submission.problem.publicTestCases : submission.problem.privateTestCases;
        const rerunTestCases = Array.isArray(selectedTestCases) ? selectedTestCases.map(normalizeTestCase) : [];
        const testCases = isPublicRun && rerunTestCases.length > 0
            ? [...(Array.isArray(baseTestCases) ? baseTestCases : []), ...rerunTestCases]
            : baseTestCases;
        
        const paramaterType = submission.problem.parameterTypes;
        const parameterNames = submission.problem.parameterNames;
        
        await WorkerService.updateStatus(submissionId, 'Running');
        
        const safeTestCases = Array.isArray(testCases) ? testCases.map(normalizeTestCase) : [];
        
        const fullCodeToRun = WrapperService.wrapCode(
            submission.language,
            submission.code,
            config.driverCode,
            safeTestCases,
            paramaterType,
            parameterNames
        );

        const { stdout } = await DockerService.executeContainer(
            'submission',
            submission.language,
            fullCodeToRun,
            config.memoryLimit,
            config.timeLimit
        );

        const gradingResult = GradingService.evaluateOutput(stdout, safeTestCases, isPublicRun);
        const allDetails = gradingResult.details || [];

        let passedCount = 0;
        for (let i = 0; i < safeTestCases.length; i++) {
            const actualLine = String(stdout || '').trim().split(/\r?\n/)[i];
            if (actualLine === undefined) break;

            const caseResult = GradingService.evaluateSingleCase(actualLine, safeTestCases[i], i + 1, isPublicRun);
            if (!caseResult.passed) break;
            passedCount += 1;
        }

        const finalStatus = gradingResult.status || 'Accepted';
        const shouldPersistDetails = isPublicRun || finalStatus !== 'Accepted';

        await WorkerService.updateStatus(submissionId, finalStatus, {
            testCasesPassed: passedCount,
            totalTestCases: safeTestCases.length,
            errorMessage: shouldPersistDetails && allDetails.length > 0 ? JSON.stringify(allDetails) : null
        });

    } catch (error: any) {
        const finalStatus = GradingService.mapSystemError(error.message);
        await WorkerService.updateStatus(submissionId, finalStatus);
    }
};
