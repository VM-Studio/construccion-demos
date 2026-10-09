/**
 * Genera la clave privada y el pedido de certificado (CSR) para los web services de ARCA.
 *
 *   pnpm arca:csr -- --cuit 30712345678 --empresa "Aceros RNF SRL" [--alias aceros-rnf-padron]
 *
 * Deja en `arca/` (ignorada por git):
 *   - <alias>.key  → CLAVE PRIVADA. Nunca sale de VM Studio: se carga en Vercel como ARCA_KEY.
 *   - <alias>.csr  → se sube a ARCA en "Administración de Certificados Digitales".
 * Con el .crt que devuelve ARCA: ver docs/ARCA-PADRON.md (cómo cargarlo en base64).
 */
import fs from "node:fs";
import path from "node:path";
import forge from "node-forge";
import { validarCUIT } from "../src/domain/cuit";

const args = process.argv.slice(2);
const arg = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const cuit = (arg("cuit") ?? "").replace(/\D/g, "");
const empresa = arg("empresa") ?? "";
const alias = (arg("alias") ?? "aceros-rnf-padron").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
if (validarCUIT(cuit) || !empresa) {
  console.error('Uso: pnpm arca:csr -- --cuit 30712345678 --empresa "Razón social" [--alias nombre]');
  process.exit(1);
}

const dir = path.resolve(__dirname, "../arca");
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const keyFile = path.join(dir, `${alias}.key`);
if (fs.existsSync(keyFile)) {
  console.error(`Ya existe ${keyFile}: no se pisa una clave privada. Usá otro --alias o borrala a mano.`);
  process.exit(1);
}

console.log("Generando clave RSA de 2048 bits…");
const keys = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
const csr = forge.pki.createCertificationRequest();
csr.publicKey = keys.publicKey;
// ARCA pide: C=AR, O=<empresa>, CN=<alias>, serialNumber=CUIT <cuit>
csr.setSubject([
  { name: "countryName", value: "AR" },
  { name: "organizationName", value: empresa },
  { name: "commonName", value: alias },
  { type: "2.5.4.5", value: `CUIT ${cuit}` },
]);
csr.sign(keys.privateKey, forge.md.sha256.create());
fs.writeFileSync(keyFile, forge.pki.privateKeyToPem(keys.privateKey), { mode: 0o600 });
fs.writeFileSync(path.join(dir, `${alias}.csr`), forge.pki.certificationRequestToPem(csr));
console.log(`✔ Clave privada: arca/${alias}.key (NO compartir)`);
console.log(`✔ Pedido de certificado: arca/${alias}.csr → subirlo a ARCA (ver docs/ARCA-PADRON.md)`);
