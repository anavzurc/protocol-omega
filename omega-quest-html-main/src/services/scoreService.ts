import Parse from "./parse";

export async function saveScore(
  score: number,
  gameMode: "story" | "arcade"
) {
  const currentUser =
    await Parse.User.currentAsync();

  if (!currentUser) {
    throw new Error(
      "Usuário não autenticado"
    );
  }

  const Score =
    Parse.Object.extend("Score");

  const newScore =
    new Score();

  newScore.set(
    "player",
    currentUser
  );

  newScore.set(
    "username",
    currentUser.get("username")
  );

  newScore.set(
    "score",
    score
  );

  newScore.set(
    "gameMode",
    gameMode
  );

  return await newScore.save();
}