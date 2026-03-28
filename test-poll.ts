// test-poll.ts

// Helper function to force the script to wait for X milliseconds
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function pollSubmission(submissionId: string) {
    const url = `http://localhost:3000/api/submissions/${submissionId}/status`;
    console.log(`📡 Starting poll for Submission: ${submissionId}\n`);

    while (true) {
        try {
            // Using Node's native fetch to hit your Express API
            const response = await fetch(url);
            const data = await response.json();

            if (!data.success) {
                console.error("❌ Error fetching status:", data.message);
                break; // Exit the infinite loop if something broke
            }

            const currentStatus = data.status;
            
            // Print the current status to the terminal
            console.log(`[${new Date().toLocaleTimeString()}] Status: ${currentStatus}`);

            // If the status is final, we break the infinite loop!
            if (currentStatus !== "Pending" && currentStatus !== "Running") {
                console.log(`\n🎉 Execution Complete! Final Verdict: ${currentStatus}`);
                break;
            }

            // Wait exactly 1 second before asking again
            await sleep(1000);

        } catch (error: any) {
            console.error("🚨 Network error while polling:", error.message);
            break;
        }
    }
}

// ==========================================
// TO RUN: Paste your UUID here and run `npx ts-node test-poll.ts`
// ==========================================
const TEST_SUBMISSION_ID = "PASTE_YOUR_UUID_HERE";

pollSubmission(TEST_SUBMISSION_ID);