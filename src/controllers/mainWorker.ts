import express from 'express';
import { createTempFolder, saveFile, deleteFolder } from '../utils/workspace.util.ts';
import { generateWrappedCode } from '../services/wrapper.service.ts';
import { executeContainer } from '../services/docker.service.ts';
import { evaluateOutput } from '../services/grading.service.ts';

type Request = express.Request;
type Response = express.Response;

export const handleSubmission = async (req: Request, res: Response) => {
    const { code, language } = req.body;

    if (!code || !language) {
        return res.status(400).json({ success: false, status: "Bad Request", message: "Code and language are required." });
    }

    // 1. Setup the isolated workspace
    const { dirPath } = await createTempFolder();

    try {
        // 2. Generate the testing wrapper
        const { filename, fullCode, dockerCmd } = generateWrappedCode(language, code);

        // 3. Save the combined code to the hard drive
        await saveFile(dirPath, filename, fullCode);

        // 4. Run the secure Docker container and wait for the output
        const rawOutput = await executeContainer(dockerCmd, dirPath);

        // 5. Grade the output against the test cases
        const finalGrade = evaluateOutput(rawOutput);

        // 6. Return the results to the frontend
        res.json({ success: true, ...finalGrade });

    } catch (error: any) {
        // Handle explicit timeouts and runtime/compilation errors gracefully
        if (error.message === "Time Limit Exceeded") {
            return res.json({ success: false, status: "Time Limit Exceeded", results: [] });
        }

        if (error.message?.includes("is not supported")) {
            return res.status(400).json({ success: false, status: "Unsupported Language", message: error.message });
        }
        
        // This catches syntax errors in JS/Python or compilation errors in C++/Java
        res.json({ success: false, status: "Runtime/Compilation Error", error: error.message });

    } finally {
        // 7. ALWAYS clean up the hard drive, even if the code crashed
        await deleteFolder(dirPath);
    }
};