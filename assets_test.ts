// Test di integrità dei file del sito (eseguiti da `deno test` nella CI).
// Verificano che tutti gli asset di gioco siano presenti, non vuoti e
// correttamente referenziati dalle pagine HTML.

function fail(message: string): never {
  throw new Error(message);
}

async function assertFileExists(path: string): Promise<void> {
  const stat = await Deno.stat(path);
  if (!stat.isFile) fail(`atteso file regolare: ${path}`);
  if ((stat.size ?? 0) === 0) fail(`file vuoto: ${path}`);
}

Deno.test("gli asset del sito sono presenti e non vuoti", async () => {
  const asset = [
    "index.html",
    "game.js",
    "style.css",
    "tetris.html",
    "tetris.js",
    "tetris.css",
    "README.md",
  ];
  for (const path of asset) {
    await assertFileExists(path);
  }
});

Deno.test("index.html richiama game.js e style.css", async () => {
  const html = await Deno.readTextFile("index.html");
  if (!html.includes("game.js")) fail("index.html non include game.js");
  if (!html.includes("style.css")) fail("index.html non include style.css");
});

Deno.test("tetris.html richiama tetris.js e tetris.css", async () => {
  const html = await Deno.readTextFile("tetris.html");
  if (!html.includes("tetris.js")) fail("tetris.html non include tetris.js");
  if (!html.includes("tetris.css")) fail("tetris.html non include tetris.css");
});
