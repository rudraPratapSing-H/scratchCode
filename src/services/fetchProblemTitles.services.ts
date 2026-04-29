import { prisma } from '../lib/prisma.ts';

export async function fetchProblemTitles() {

  const problems = await prisma.problem.findMany({
    // here we well take the fields that we need for the problem match card, which are id, title and difficulty
    select: { id: true, title: true, difficulty: true }
  });

  return problems.map(p => ({ id: p.id, title: p.title, difficulty: p.difficulty }));


}