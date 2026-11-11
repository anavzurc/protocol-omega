import Parse from "./parse";

export async function saveProgress(
  room: number,
  score: number,
  gameMode: string,
  difficulty: string
) {
  const currentUser =
    await Parse.User.currentAsync();

  if (!currentUser) return;

  const Progress =
    Parse.Object.extend("Progress");

  const query =
    new Parse.Query(Progress);

  query.equalTo(
    "player",
    currentUser
  );

  let progress =
    await query.first();

  if (!progress) {
    progress =
      new Progress();

    progress.set(
      "player",
      currentUser
    );
  }

  progress.set(
    "currentLevel",
    room
  );

  progress.set(
    "coins",
    score
  );

  progress.set(
    "lastCheckpoint",
    `${gameMode}-${difficulty}`
  );

  await progress.save();
}