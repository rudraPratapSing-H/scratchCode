export const generateWrappedCode = (language: string, userCode: string) => {
    const separator = "|||---|||";
    let filename = "";
    let fullCode = "";
    let dockerCmd = "";

    // For the MVP, we are hardcoding the Two Sum test cases here.
    // In production, these would be fetched from your PostgreSQL database.
    
    if (language === 'javascript') {
        filename = 'main.js';
        fullCode = `
${userCode}

// --- AUTO-GRADER WRAPPER ---
try {
    console.log(JSON.stringify(twoSum([2, 7, 11, 15], 9)));
    console.log("${separator}");
    console.log(JSON.stringify(twoSum([3, 2, 4], 6)));
} catch (error) {
    console.error("RUNTIME_ERROR: " + error.message);
}
        `;
        dockerCmd = `docker run --rm --memory="256m" --cpus="0.5" --network none --pids-limit 64 --security-opt no-new-privileges --read-only -v "{DIR_PATH}":/app -w /app node:18-alpine node ${filename}`;
    } 
    else if (language === 'python') {
        filename = 'main.py';
        fullCode = `
import json
${userCode}

# --- AUTO-GRADER WRAPPER ---
try:
    print(json.dumps(twoSum([2, 7, 11, 15], 9)))
    print("${separator}")
    print(json.dumps(twoSum([3, 2, 4], 6)))
except Exception as e:
    print("RUNTIME_ERROR:", str(e))
        `;
        dockerCmd = `docker run --rm --memory="256m" --cpus="0.5" --network none --pids-limit 64 --security-opt no-new-privileges --read-only -v "{DIR_PATH}":/app -w /app python:3.11-alpine python ${filename}`;
    }
    else if (language === 'cpp') {
        filename = 'main.cpp';
        fullCode = `
#include <iostream>
#include <vector>
using namespace std;

${userCode}

// --- AUTO-GRADER WRAPPER ---
int main() {
    try {
        vector<int> result1 = twoSum({2, 7, 11, 15}, 9);
        cout << "[" << result1[0] << "," << result1[1] << "]" << endl;
        cout << "${separator}" << endl;
        
        vector<int> result2 = twoSum({3, 2, 4}, 6);
        cout << "[" << result2[0] << "," << result2[1] << "]" << endl;
    } catch (exception& e) {
        cerr << "RUNTIME_ERROR: " << e.what() << endl;
    }
    return 0;
}
        `;
        dockerCmd = `docker run --rm --memory="256m" --cpus="0.5" --network none --pids-limit 64 --security-opt no-new-privileges --read-only -v "{DIR_PATH}":/app -w /app gcc:latest sh -c "g++ ${filename} -o main.out && ./main.out"`;
    }
    else if (language === 'java') {
        filename = 'Solution.java';
        fullCode = `
import java.util.*;

${userCode}

// --- AUTO-GRADER WRAPPER ---
public class Solution {
    public static void main(String[] args) {
        try {
            Solution solution = new Solution();
            int[] result1 = solution.twoSum(new int[]{2, 7, 11, 15}, 9);
            System.out.println("[" + result1[0] + "," + result1[1] + "]");
            System.out.println("${separator}");
            
            int[] result2 = solution.twoSum(new int[]{3, 2, 4}, 6);
            System.out.println("[" + result2[0] + "," + result2[1] + "]");
        } catch (Exception e) {
            System.err.println("RUNTIME_ERROR: " + e.getMessage());
        }
    }
    
    ${userCode}
}
        `;
        dockerCmd = `docker run --rm --memory="256m" --cpus="0.5" --network none --pids-limit 64 --security-opt no-new-privileges --read-only -v "{DIR_PATH}":/app -w /app openjdk:17-alpine sh -c "javac ${filename} && java Solution"`;
    }
    else {
        throw new Error(`Language '${language}' is not supported.`);
    }

    return { filename, fullCode, dockerCmd };
};