/** Vérification du chemin des reçus : téléversement, rattachement, relecture. */

const BASE = `${process.env.API_URL ?? "http://localhost:3000"}/api`;
let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "  OK  " : " ECHEC"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

const stamp = Date.now();
const register = async (email) => {
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "MotDePasse123!" }),
  });
  return (await res.json()).accessToken;
};

const tokA = await register(`recu-a-${stamp}@test.ci`);
const tokB = await register(`recu-b-${stamp}@test.ci`);

// PNG 1x1 valide, le plus petit fichier qui reste une vraie image.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const upload = async (token, bytes, type, name) => {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type }), name);
  const res = await fetch(`${BASE}/receipts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};

console.log("\n=== Reçus ===");
const up = await upload(tokA, PNG, "image/png", "recu.png");
check("POST /receipts → 201", up.status === 201, `statut ${up.status}`);
const receiptId = up.body?.id;
check("identifiant renvoyé", Boolean(receiptId));

const bad = await upload(tokA, Buffer.from("#!/bin/sh\nrm -rf /"), "application/x-sh", "x.sh");
check("format refusé → 400", bad.status === 400, `statut ${bad.status}`);

const dl = await fetch(`${BASE}/receipts/${receiptId}`, {
  headers: { Authorization: `Bearer ${tokA}` },
});
const bytes = Buffer.from(await dl.arrayBuffer());
check("Alice relit son reçu → 200", dl.status === 200, `statut ${dl.status}`);
check("type MIME conservé", dl.headers.get("content-type")?.includes("image/png"));
check("cache privé", dl.headers.get("cache-control")?.includes("private"));
check("octets identiques à l'envoi", bytes.equals(PNG), `${bytes.length} octets`);

const stolen = await fetch(`${BASE}/receipts/${receiptId}`, {
  headers: { Authorization: `Bearer ${tokB}` },
});
check("Bob ne peut PAS lire le reçu d'Alice → 404", stolen.status === 404, `statut ${stolen.status}`);

const anon = await fetch(`${BASE}/receipts/${receiptId}`);
check("sans jeton → 401", anon.status === 401, `statut ${anon.status}`);

// Rattachement à une dépense, puis relecture depuis le snapshot.
const snap = await (await fetch(`${BASE}/snapshot`, {
  headers: { Authorization: `Bearer ${tokA}` },
})).json();
const res = await fetch(`${BASE}/expenses`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokA}` },
  body: JSON.stringify({
    categoryId: snap.expenseCategories[0].id,
    spentOn: "2026-09-03",
    amount: 7500,
    receiptId,
  }),
});
check("dépense avec reçu → 201", res.status === 201, `statut ${res.status}`);

const after = await (await fetch(`${BASE}/snapshot`, {
  headers: { Authorization: `Bearer ${tokA}` },
})).json();
check(
  "le snapshot renvoie le receiptId",
  after.expenseEntries?.[0]?.receiptId === receiptId,
  `${after.expenseEntries?.[0]?.receiptId}`,
);

// Reçu d'autrui référencé dans une dépense : doit être refusé.
const upB = await upload(tokB, PNG, "image/png", "recu-b.png");
const cross = await fetch(`${BASE}/expenses`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokA}` },
  body: JSON.stringify({
    categoryId: snap.expenseCategories[0].id,
    spentOn: "2026-09-03",
    amount: 100,
    receiptId: upB.body.id,
  }),
});
check("Alice ne peut pas joindre le reçu de Bob → 404", cross.status === 404, `statut ${cross.status}`);

console.log(`\n${failures === 0 ? "TOUT PASSE" : `${failures} ECHEC(S)`}\n`);
process.exit(failures === 0 ? 0 : 1);
