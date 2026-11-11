import Parse from "./parse";

export async function saveMatch(
  score: number,
  result: "victory" | "defeat",
  mode: string,
  difficulty: string
) {
  const currentUser =
    await Parse.User.currentAsync();

  if (!currentUser) return;

  const Match =
    Parse.Object.extend("Match");

  const match =
    new Match();

  match.set(
    "player",
    currentUser
  );

  match.set(
    "username",
    currentUser.get("username")
  );

  match.set(
    "score",
    score
  );

  match.set(
    "result",
    result
  );

  match.set(
    "mode",
    mode
  );

  match.set(
    "difficulty",
    difficulty
  );

  match.set(
    "duration",
    0
  );

  await match.save();
}