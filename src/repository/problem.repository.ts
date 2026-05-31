import { prisma } from '../lib/prisma.ts'; // Update import path if using custom output

type ProblemSearchRow = {
    id: string;
    title: string;
    difficulty: string;
    similarityScore: number;
};

export const ProblemRepository = {
    
    async createProblemWithLanguages(problemData: any, languageConfigs: any[]) {
        // This is a Prisma "Nested Write". It is 100% atomic.
        return await prisma.problem.create({
            data: {
                id: problemData.id,
                title: problemData.title,
                description: problemData.description,
                difficulty: problemData.difficulty,
                organizationId: problemData.organizationId ?? null,
                publicTestCases: problemData.publicTestCases,
                privateTestCases: problemData.privateTestCases,
                parameterTypes: problemData.parameterTypes,
                // Automatically inserts into the ProblemLanguage table!
                languageConfigs: {
                    create: languageConfigs
                }
            },
            include: {
                // Tells Prisma to return the newly created languages in the response
                languageConfigs: true 
            }
        });
    }

    ,

    async findProblemById(problemId: string) {
        return await prisma.problem.findUnique({
            where: { id: problemId },
            include: {
                languageConfigs: true
            }
        });
    },

    async findProblemByTitleExact(query: string): Promise<ProblemSearchRow | null> {
        const result = await prisma.problem.findFirst({
            where: {
                title: {
                    equals: query,
                    mode: 'insensitive'
                }
            },
            select: {
                id: true,
                title: true,
                difficulty: true
            }
        });

        if (!result) return null;

        return {
            id: result.id,
            title: result.title,
            difficulty: String(result.difficulty),
            similarityScore: 1
        };
    },

    async findProblemsByTitleFuzzy(query: string, limit: number, minThreshold: number): Promise<ProblemSearchRow[]> {
        const rawRows = await prisma.$queryRaw<Array<{ id: string; title: string; difficulty: string; similarity_score: number }>>`
            SELECT
                p."id",
                p."title",
                p."difficulty"::text AS difficulty,
                similarity(lower(p."title"), lower(${query})) AS similarity_score
            FROM "Problem" p
            WHERE similarity(lower(p."title"), lower(${query})) >= ${minThreshold}
            ORDER BY similarity_score DESC, p."title" ASC
            LIMIT ${limit}
        `;

        return rawRows.map((row) => ({
            id: row.id,
            title: row.title,
            difficulty: row.difficulty,
            similarityScore: Number(row.similarity_score)
        }));
    }
};