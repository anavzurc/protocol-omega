import Parse from "./parse";

export interface RankingEntry {
  username: string;
  score: number;
  gameMode: string;
}

export async function getRanking(): Promise<
  RankingEntry[]
> {
  const scoreQuery =
    new Parse.Query("Score");

  scoreQuery.descending("score");
  scoreQuery.limit(100);

  const scoreResults =
    await scoreQuery.find();

  const bestScores =
    new Map<string, RankingEntry>();

  for (const scoreItem of scoreResults) {

    const username =
      scoreItem.get("username");

    if (!username) continue;

    const score =
      scoreItem.get("score") ?? 0;

    const gameMode =
      scoreItem.get("gameMode") ??
      "story";

    const currentBest =
      bestScores.get(username);

    if (
      !currentBest ||
      score > currentBest.score
    ) {
      bestScores.set(
        username,
        {
          username,
          score,
          gameMode,
        }
      );
    }
  }

  return Array
    .from(bestScores.values())
    .sort(
      (a, b) =>
        b.score - a.score
    )
    .slice(0, 10);
}