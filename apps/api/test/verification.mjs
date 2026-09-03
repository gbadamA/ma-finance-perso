/**
 * Vérification de bout en bout de l'API, contre une base réelle.
 *
 * L'essentiel n'est pas que les écritures marchent — c'est que **l'utilisateur B
 * ne puisse rien lire ni écrire chez A**. C'est ce que la RLS de Supabase
 * garantissait au niveau du moteur Postgres et que le code doit désormais
 * garantir seul : ce fichier est le filet.
 *
 *   node test/verification.mjs                          # API locale
 *   API_URL=https://…onrender.com node test/verification.mjs
 *
 * ⚠️ Chaque exécution crée des comptes de test (`alice-<horodatage>@test.ci`).
 * À ne PAS lancer contre une base contenant de vraies données.
 */

const BASE = `${process.env.API_URL ?? "http://localhost:3000"}/api`;
let failures = 0;

function check(label, ok, detail = "") {
  console.log(`${ok ? "  OK  " : " ECHEC"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function call(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* corps non-JSON */
  }
  return { status: res.status, body: json, text };
}

const stamp = Date.now();
const A = { email: `alice-${stamp}@test.ci`, password: "MotDePasse123!" };
const B = { email: `bob-${stamp}@test.ci`, password: "MotDePasse123!" };

console.log("\n=== 1. Santé et fermeture par défaut ===");
check("GET /health répond 200", (await call("/health")).status === 200);
check("GET /snapshot sans jeton → 401", (await call("/snapshot")).status === 401);

console.log("\n=== 2. Inscription ===");
const regA = await call("/auth/register", { method: "POST", body: A });
check("inscription d'Alice → 201", regA.status === 201, `statut ${regA.status}`);
check("jetons renvoyés", Boolean(regA.body?.accessToken && regA.body?.refreshToken));
const tokA = regA.body?.accessToken;

const dup = await call("/auth/register", { method: "POST", body: A });
check("même e-mail à nouveau → 409", dup.status === 409, `statut ${dup.status}`);

const regB = await call("/auth/register", { method: "POST", body: B });
const tokB = regB.body?.accessToken;
check("inscription de Bob → 201", regB.status === 201);

console.log("\n=== 3. Semis initial ===");
const snapA = await call("/snapshot", { token: tokA });
check("GET /snapshot → 200", snapA.status === 200, `statut ${snapA.status}`);
const d = snapA.body ?? {};
check("8 catégories de dépenses", d.expenseCategories?.length === 8, `${d.expenseCategories?.length}`);
check("4 sources de revenus", d.incomeSources?.length === 4, `${d.incomeSources?.length}`);
check("2 comptes", d.accounts?.length === 2, `${d.accounts?.length}`);
check("5 allocations cibles", d.targets?.length === 5, `${d.targets?.length}`);
check("38 actions d'économie", d.savingsActions?.length === 38, `${d.savingsActions?.length}`);
check("réglages présents", d.settings?.currency === "XOF", `${d.settings?.currency}`);
check("aucune dépense au départ", d.expenseEntries?.length === 0, `${d.expenseEntries?.length}`);

console.log("\n=== 4. Écritures d'Alice ===");
const catA = d.expenseCategories?.[0]?.id;
const addExp = await call("/expenses", {
  method: "POST",
  token: tokA,
  body: { categoryId: catA, spentOn: "2026-09-02", amount: 12500, note: "Taxi" },
});
check("POST /expenses → 201", addExp.status === 201, `statut ${addExp.status}`);

const srcA = d.incomeSources?.[0]?.id;
check(
  "PUT /income → 204",
  (await call("/income", {
    method: "PUT",
    token: tokA,
    body: { sourceId: srcA, month: "2026-09", amount: 450000 },
  })).status === 204,
);
// Deux fois de suite : l'upsert doit corriger, pas doubler.
await call("/income", {
  method: "PUT",
  token: tokA,
  body: { sourceId: srcA, month: "2026-09", amount: 500000 },
});

const accA = d.accounts?.[0]?.id;
check(
  "PUT /balances → 204",
  (await call("/balances", {
    method: "PUT",
    token: tokA,
    body: { month: "2026-09", balances: [{ accountId: accA, balance: 1750000 }] },
  })).status === 204,
);

check(
  "PUT /investments → 204",
  (await call("/investments", {
    method: "PUT",
    token: tokA,
    body: { month: "2026-09", amounts: [{ assetClass: "actions", amount: 900000 }] },
  })).status === 204,
);

// Taux décimal : c'est le bug de DTO corrigé (IsInt -> IsNumber).
check(
  "PATCH /settings avec un taux décimal → 204",
  (await call("/settings", {
    method: "PATCH",
    token: tokA,
    body: { safeWithdrawalRate: 4.25, expectedReturn: 7.5, currency: "XOF" },
  })).status === 204,
);

check(
  "PATCH /settings avec un champ inconnu → 400",
  (await call("/settings", { method: "PATCH", token: tokA, body: { admin: true } })).status === 400,
);

check(
  "PUT /goals → 204",
  (await call("/goals", {
    method: "PUT",
    token: tokA,
    body: { kind: "fortune", horizon: "court", label: "Fonds d'urgence", targetAmount: 3000000 },
  })).status === 204,
);

const after = (await call("/snapshot", { token: tokA })).body;
check("1 dépense enregistrée", after.expenseEntries?.length === 1, `${after.expenseEntries?.length}`);
check("montant relu correctement", after.expenseEntries?.[0]?.amount === 12500, `${after.expenseEntries?.[0]?.amount}`);
check(
  "revenu corrigé et non doublé",
  after.incomeEntries?.length === 1 && after.incomeEntries[0].amount === 500000,
  `${after.incomeEntries?.length} ligne(s), ${after.incomeEntries?.[0]?.amount}`,
);
check("solde enregistré", after.accountSnapshots?.[0]?.balance === 1750000, `${after.accountSnapshots?.[0]?.balance}`);
check("taux décimal conservé", after.settings?.safeWithdrawalRate === 4.25, `${after.settings?.safeWithdrawalRate}`);
check("1 objectif", after.goals?.length === 1, `${after.goals?.length}`);

console.log("\n=== 5. Isolation entre comptes (le point critique) ===");
const snapB = (await call("/snapshot", { token: tokB })).body;
check("Bob ne voit aucune dépense d'Alice", snapB.expenseEntries?.length === 0, `${snapB.expenseEntries?.length}`);
check("Bob ne voit aucun revenu d'Alice", snapB.incomeEntries?.length === 0, `${snapB.incomeEntries?.length}`);
check("Bob a son propre semis", snapB.expenseCategories?.length === 8);
check(
  "les catégories de Bob sont d'autres lignes",
  snapB.expenseCategories?.[0]?.id !== d.expenseCategories?.[0]?.id,
);

const expenseIdA = after.expenseEntries[0].id;
check(
  "Bob ne peut pas supprimer la dépense d'Alice → 404",
  (await call(`/expenses/${expenseIdA}`, { method: "DELETE", token: tokB })).status === 404,
);

check(
  "Bob ne peut pas écrire dans une catégorie d'Alice → 404",
  (await call("/expenses", {
    method: "POST",
    token: tokB,
    body: { categoryId: catA, spentOn: "2026-09-02", amount: 999 },
  })).status === 404,
);

const assetIdA = after.assets?.[0]?.id;
if (assetIdA) {
  check(
    "Bob ne peut pas modifier un bien d'Alice → 404",
    (await call(`/assets/${assetIdA}/value`, { method: "PATCH", token: tokB, body: { value: 1 } }))
      .status === 404,
  );
}

const savingsIdA = after.savingsActions[0].id;
check(
  "Bob ne peut pas cocher une action d'Alice → 404",
  (await call(`/savings/${savingsIdA}`, { method: "PATCH", token: tokB, body: { done: true } }))
    .status === 404,
);

const goalIdA = after.goals[0].id;
check(
  "Bob ne peut pas supprimer un objectif d'Alice → 404",
  (await call(`/goals/${goalIdA}`, { method: "DELETE", token: tokB })).status === 404,
);

// Et Alice, elle, y arrive bien : sans ça les 404 ci-dessus ne prouveraient rien.
check(
  "Alice coche bien sa propre action → 204",
  (await call(`/savings/${savingsIdA}`, { method: "PATCH", token: tokA, body: { done: true } }))
    .status === 204,
);

console.log("\n=== 6. Connexion et jetons ===");
check(
  "mauvais mot de passe → 401",
  (await call("/auth/login", { method: "POST", body: { ...A, password: "faux" } })).status === 401,
);
check(
  "e-mail inconnu → 401",
  (await call("/auth/login", { method: "POST", body: { email: "personne@test.ci", password: "x" } }))
    .status === 401,
);
const login = await call("/auth/login", { method: "POST", body: A });
check("connexion correcte → 200", login.status === 200, `statut ${login.status}`);

const refreshed = await call("/auth/refresh", {
  method: "POST",
  body: { refreshToken: login.body.refreshToken },
});
check("rafraîchissement → 200", refreshed.status === 200, `statut ${refreshed.status}`);
check(
  "le jeton de rafraîchissement a tourné",
  refreshed.body?.refreshToken && refreshed.body.refreshToken !== login.body.refreshToken,
);
check(
  "l'ancien jeton de rafraîchissement est rejeté",
  (await call("/auth/refresh", { method: "POST", body: { refreshToken: login.body.refreshToken } }))
    .status === 401,
);
check(
  "le nouveau jeton d'accès fonctionne",
  (await call("/snapshot", { token: refreshed.body.accessToken })).status === 200,
);

await call("/auth/logout", {
  method: "POST",
  token: refreshed.body.accessToken,
  body: { refreshToken: refreshed.body.refreshToken },
});
check(
  "après déconnexion, le rafraîchissement échoue",
  (await call("/auth/refresh", {
    method: "POST",
    body: { refreshToken: refreshed.body.refreshToken },
  })).status === 401,
);

console.log("\n=== 7. Validation ===");
check(
  "mot de passe trop court → 400",
  (await call("/auth/register", { method: "POST", body: { email: `x${stamp}@t.ci`, password: "abc" } }))
    .status === 400,
);
check(
  "montant négatif → 400",
  (await call("/expenses", {
    method: "POST",
    token: tokA,
    body: { categoryId: catA, spentOn: "2026-09-02", amount: -5 },
  })).status === 400,
);
check(
  "mois mal formé → 400",
  (await call("/income", { method: "PUT", token: tokA, body: { sourceId: srcA, month: "septembre", amount: 1 } }))
    .status === 400,
);
check(
  "jeton bidon → 401",
  (await call("/snapshot", { token: "pas-un-jeton" })).status === 401,
);

console.log(`\n${failures === 0 ? "TOUT PASSE" : `${failures} ECHEC(S)`}\n`);
process.exit(failures === 0 ? 0 : 1);
