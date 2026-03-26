// test-security.js
// Run this file using: node test-security.js

const API_URL = 'http://localhost:8000/api/execute';

const testCases = [
    {
        name: "✅ 1. Sanity Check (Valid JS)",
        language: "javascript",
        expectedStatus: "Accepted",
        code: `
function twoSum(nums, target) {
    for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) {
            if (nums[i] + nums[j] === target) return [i, j];
        }
    }
}
        `
    },
    {
        name: "⏱️ 2. The Infinite Loop (JS - Time Limit Exceeded)",
        language: "javascript",
        expectedStatus: "Time Limit Exceeded",
        code: `
function twoSum(nums, target) {
    while(true) {
        // I am trying to hog your CPU forever
    }
}
        `
    },
    {
        name: "💥 3. The Memory Leak (Python - Out of Memory Kill)",
        language: "python",
        expectedStatus: "Runtime/Compilation Error", // Docker will kill it before the timeout
        code: `
def twoSum(nums, target):
    arr = []
    while True:
        # I am trying to eat all 256MB of your server's RAM in a fraction of a second
        arr.append("A" * 10**6) 
        `
    },
    {
        name: "🦠 4. The Fork Bomb (C++ - PIDs Limit)",
        language: "cpp",
        expectedStatus: "Runtime/Compilation Error", 
        code: `
#include <unistd.h>
class Solution {
public:
    std::vector<int> twoSum(std::vector<int>& nums, int target) {
        // I am trying to spawn thousands of child processes to crash your host OS
        while(true) {
            fork(); 
        }
        return {};
    }
};
        `
    },
    {
        name: "❌ 5. Syntax Error Check (Java)",
        language: "java",
        expectedStatus: "Runtime/Compilation Error",
        code: `
class Solution {
    public int[] twoSum(int[] nums, int target) {
        this is not valid java code;
    }
}
        `
    },
    {
        name: "🌊 6. The Output Flooder (JS - Buffer Crash Attempt)",
        language: "javascript",
        expectedStatus: "Time Limit Exceeded", // Should be killed before it crashes your Node server
        code: `
function twoSum(nums, target) {
    // Trying to crash your server by printing gigabytes of text
    while(true) {
        console.log("SPAM ".repeat(10000));
    }
}
        `
    },
    {
        name: "🌐 7. The Network Hacker (Python - Air-Gap Test)",
        language: "python",
        expectedStatus: "Time Limit Exceeded", 
        code: `
def twoSum(nums, target):
    import urllib.request
    try:
        # Trying to use your server to access the internet (should be blocked by --network none)
        urllib.request.urlopen('http://google.com')
        return [1, 2]
    except Exception as e:
        raise Exception("Network Access Blocked: " + str(e))
        `
    },
    {
        name: "📂 8. The File Snooper (C++ - Read-Only File System)",
        language: "cpp",
        expectedStatus: "Runtime/Compilation Error",
        code: `
#include <fstream>
#include <vector>
class Solution {
public:
    std::vector<int> twoSum(std::vector<int>& nums, int target) {
        // Trying to create a file outside our allowed /app folder
        std::ofstream outfile ("/etc/hacked.txt");
        if(outfile.is_open()) {
            outfile << "I hacked your server!";
            outfile.close();
        } else {
            throw std::runtime_error("File System is Read-Only!");
        }
        return {0, 1};
    }
};
        `
    },{
        name: "👎 9. The Wrong Answer (JS - Logic Test)",
        language: "javascript",
        expectedStatus: "Wrong Answer", // The code runs perfectly, but the math is wrong
        code: `
function twoSum(nums, target) {
    // Returning dummy data instead of the actual solution
    return [0, 0];
}
        `
    },
    {
        name: "✅ 10. Valid Python Solution",
        language: "python",
        expectedStatus: "Accepted",
        code: `
def twoSum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff],i]
        seen[num] = i
    return []
        `
    },
    {
        name: "✅ 11. Valid C++ Solution",
        language: "cpp",
        expectedStatus: "Accepted",
        code: `
#include <unordered_map>
#include <vector>
class Solution {
public:
    std::vector<int> twoSum(std::vector<int>& nums, int target) {
        std::unordered_map<int, int> seen;
        for (int i = 0; i < nums.size(); ++i) {
            int diff = target - nums[i];
            if (seen.count(diff)) {
                return {seen[diff],i};
            }
            seen[nums[i]] = i;
        }
        return {};
    }
};
        `
    }
];

async function runTests() {
    console.log("🚀 Starting Security & Execution Stress Tests...\n");
    let passedTests = 0;

    for (let i = 0; i < testCases.length; i++) {
        const test = testCases[i];
        console.log(`▶️  Running: ${test.name}...`);
        
        const startTime = Date.now();
        
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    language: test.language,
                    code: test.code,
                    problemId: "two-sum" // In case you implemented the dynamic controller
                })
            });

            const data = await response.json();
            const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);

            if (data.status === test.expectedStatus || (data.status.includes("Time Limit") && test.expectedStatus.includes("Time"))) {
                console.log(`   ✅ PASS! Result: [${data.status}] in ${timeTaken}s`);
                passedTests++;
            } else {
                console.log(`   ❌ FAIL! Expected [${test.expectedStatus}] but got [${data.status}] in ${timeTaken}s`);
                console.log(`      Error details:`, data.error || data.results);
            }
        } catch (error) {
            console.log(`   ⚠️ CRITICAL FAILURE: Server did not respond or crashed.`);
            console.error(error);
        }
        console.log("--------------------------------------------------");
    }

    console.log(`\n🏁 Tests Completed: ${passedTests} / ${testCases.length} Passed.`);
    
    if (passedTests === testCases.length) {
        console.log("🛡️  Your execution engine is bulletproof. You are cleared for Phase 3.");
    } else {
        console.log("🚧 You have security leaks. Do not move to Phase 3 until these are patched.");
    }
}

runTests();