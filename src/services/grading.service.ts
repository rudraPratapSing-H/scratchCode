export const evaluateOutput = (rawOutput: string) => {
    // Clean up whitespace and split by our invisible separator
    const userAnswers = rawOutput.trim().split("|||---|||").map(ans => ans.trim());
    
    // Hardcoded expected answers for "Two Sum"
    const expectedAnswers = ["[0, 1]", "[1, 2]"];
    
    let allPassed = true;
    let results = [];

    for (let i = 0; i < expectedAnswers.length; i++) {
        const expected = expectedAnswers[i];
        const actual = userAnswers[i] || "No Output";

        if (actual === expected) {
            results.push({ testCase: i + 1, status: "Pass" });
        } else {
            allPassed = false;
            results.push({ testCase: i + 1, status: "Fail", expected, actual });
        }
    }

    return {
        status: allPassed ? "Accepted" : "Wrong Answer",
        results
    };
};