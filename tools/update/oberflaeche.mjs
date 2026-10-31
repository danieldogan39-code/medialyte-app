// Oberflächen-Pakete für die Android-App: Schlüssel erzeugen und Pakete signieren.
//   node tools/update/oberflaeche.mjs neu                         → {"privat": <PKCS8 base64>, "oeffentlich": <SPKI base64>}
//   node tools/update/oberflaeche.mjs paket <ordner> <ziel.zip> <version>   (OBERFLAECHE_PRIVAT) → Manifest (JSON)
// Die App prüft die Signatur über „version|sha256|huelle|url“ mit dem eingebauten öffentlichen Schlüssel (WebCrypto, ECDSA P-256).
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const [, , was, ordner, ziel, version] = process.argv;
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
if (was === "neu") {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  process.stdout.write(JSON.stringify({
    privat: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"),
    oeffentlich: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
  }));
} else if (was === "paket") {
  const roh = process.env.OBERFLAECHE_PRIVAT;
  if (!roh) throw new Error("OBERFLAECHE_PRIVAT fehlt");
  const key = crypto.createPrivateKey({ key: Buffer.from(roh, "base64"), format: "der", type: "pkcs8" });
  execFileSync("zip", ["-qr", "-X", path.resolve(ziel), ".", "-x", ".htaccess", "*/.htaccess"], { cwd: ordner });
  const sha256 = crypto.createHash("sha256").update(readFileSync(ziel)).digest("hex");
  const huelle = parseInt(readFileSync(path.join(REPO, "mobile/huelle.txt"), "utf8"), 10);
  const app = JSON.parse(readFileSync(path.join(REPO, "app/package.json"), "utf8")).version;
  const url = `https://github.com/danieldogan39-code/medialyte-app/releases/download/aktualisierung/${path.basename(ziel)}`;
  const signatur = crypto.sign("sha256", Buffer.from(`${version}|${sha256}|${huelle}|${url}`), { key, dsaEncoding: "ieee-p1363" }).toString("base64");
  process.stdout.write(JSON.stringify({ version, app, huelle, url, sha256, signatur, erstellt: new Date().toISOString() }));
} else {
  console.error("Aufruf: neu | paket <ordner> <ziel.zip> <version>"); process.exit(1);
}
