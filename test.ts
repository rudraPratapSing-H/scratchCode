import { sleep } from "./utils.ts";

const BASE_URL = "https://scratchcode-25gk.onrender.com/api";
const N = 200; // Number of executions to trigger

const executePayload = {
    problemId: "sliding-window-maximum",
    language: "java",
    code: `import java.util.*;\n\nclass Solution {\n    public int[] maxSlidingWindow(int[] nums, int k) {\n\n        int[] result = new int[nums.length - k + 1];\n\n        PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> {\n            if (b[0] == a[0]) {\n                return Integer.compare(a[1], b[1]);\n            }\n            return Integer.compare(b[0], a[0]);\n        });\n\n        int indexCounter = 0;\n\n        for (int i = 1; i <= nums.length; i++) {\n\n            int[] a = {nums[i - 1], i - 1};\n\n            pq.offer(a);\n\n            if (i >= k) {\n\n                while (pq.peek()[1] < i - k) {\n                    pq.poll();\n                }\n                \n                result[indexCounter++] = pq.peek()[0];\n            }\n        }\n\n        return result;\n    }\n}`
};

async function runTest() {
    console.log("Authenticating...");
    
    // 1. Login to get session/token
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: "leonrudy1403@gmail.com",
            password: "1234"
        })
    });

    const loginData = await loginRes.json();
    
    // Grab the accessToken based on your API response
    const token = loginData.accessToken; 

    if (!token) {
        console.error("Failed to retrieve accessToken. Response was:", loginData);
        return; 
    }

    const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}` 
    };

    console.log(`Successfully authenticated as ${loginData.user.username}. Sending ${N} execution requests...`);
    const submissionIds: string[] = [];

    // 2. Send N requests
    for (let i = 0; i < N; i++) {
        const execRes = await fetch(`${BASE_URL}/execute`, {
            method: "POST",
            headers,
            body: JSON.stringify(executePayload)
        });

        const execData = await execRes.json();
        
        // Assuming the API returns the id in `submissionId` or `id`
        const id = execData.submissionId || execData.id;
        if (id) {
            submissionIds.push(id);
        } else {
            console.log(`Request ${i + 1} failed to return an ID:`, execData);
        }
    }

    const totalSubmissions = submissionIds.length;
    console.log(`Successfully queued ${totalSubmissions} submissions. Starting polling...\n`);

    // 3. Poll for status
    let acceptedCounter = 0;
    const completedSet = new Set<string>();
    let couter = 0;
    while (completedSet.size < totalSubmissions) {
        await sleep(2000); 
        console.log(`seconds elapsed: ${++couter * 2}s`);
        for (const id of submissionIds) {
            if (completedSet.has(id)) continue;

            try {
                const statusRes = await fetch(`${BASE_URL}/status/${id}`, { headers });
                const statusData = await statusRes.json();
                
                const currentStatus = statusData.status?.toLowerCase();

                if (currentStatus === "accepted") {
                    acceptedCounter++;
                    completedSet.add(id);
                    console.log(`[${id}] ✅ Accepted. (Total Accepted: ${acceptedCounter}/${totalSubmissions})`);
                } else if (currentStatus === "wrong answer" || currentStatus === "error" || currentStatus === "failed" || currentStatus === "time limit exceeded") {
                    completedSet.add(id);
                    console.log(`[${id}] ❌ Finished with status: ${currentStatus}`);
                } else {
                    console.log(`[${id}] ⏳ Status: ${currentStatus || 'Processing'}...`);
                }
            } catch (err) {
                console.error(`Error fetching status for ${id}:`, err);
            }
        }
        console.log("---");
    }

    console.log(`\nTest Complete! Total Accepted: ${acceptedCounter}/${totalSubmissions}`);
}

runTest();