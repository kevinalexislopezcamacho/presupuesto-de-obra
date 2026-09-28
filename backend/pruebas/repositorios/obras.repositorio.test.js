import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { RepositorioObras } from "../../src/repositorios/obras.repositorio.js";

test("una escritura fallida no bloquea las siguientes ni deja obras fantasma en memoria", async () => {
  const carpeta = await fs.mkdtemp(path.join(os.tmpdir(), "repo-"));
  const bloqueo = path.join(carpeta, "sub");
  await fs.writeFile(bloqueo, "un archivo donde debería ir la carpeta");    // hace fallar la primera escritura
  const repo = new RepositorioObras(path.join(bloqueo, "obras.json"));
  try {
    await assert.rejects(repo.guardar({ id: "a" }));
    assert.equal((await repo.listar()).length, 0);

    await fs.rm(bloqueo);                                                     // se arregla el problema
    await repo.guardar({ id: "b" });
    const enDisco = JSON.parse(await fs.readFile(path.join(bloqueo, "obras.json"), "utf8"));
    assert.deepEqual(enDisco.map(o => o.id), ["b"]);
    assert.equal(await repo.eliminar("no-existe"), false);
    assert.equal(await repo.eliminar("b"), true);
  } finally {
    await fs.rm(carpeta, { recursive: true, force: true });
  }
});
