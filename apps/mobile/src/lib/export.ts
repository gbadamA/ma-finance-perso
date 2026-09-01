/**
 * Export CSV et PDF — §3.1 et §6.2 du cahier des charges.
 *
 * L'utilisateur vient d'Excel : pouvoir ressortir ses données est ce qui rend
 * le passage à l'app réversible, donc acceptable. Le CSV se rouvre dans un
 * tableur, le PDF se partage par WhatsApp.
 */

import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import {
  buildOverview,
  categoryTotals,
  expensesByMonth,
  formatAmount,
  formatMonth,
  incomeByMonth,
  wealthSeries,
  type CurrencyCode,
} from "@mfp/core";
import type { Dataset } from "./data";

/* ------------------------------------------------------------------ *
 * CSV
 * ------------------------------------------------------------------ */

/**
 * Échappement CSV.
 * Indispensable ici : les notes de dépenses contiennent des virgules et des
 * apostrophes, et une note mal échappée décale toute la colonne suivante.
 */
function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: readonly (readonly (string | number | null)[])[]): string {
  // Séparateur `;` et BOM : Excel en configuration française ouvre alors le
  // fichier en colonnes du premier coup, au lieu de tout coller en colonne A.
  return "﻿" + rows.map((row) => row.map(cell).join(";")).join("\n");
}

/** Toutes les données de l'utilisateur, une section par module. */
export function buildCsv(data: Dataset): string {
  const currency = data.settings.currency;
  const money = (v: number) => (v / 10 ** minorDigits(currency)).toFixed(minorDigits(currency));

  const rows: (string | number | null)[][] = [];

  rows.push(["MA FINANCE PERSO — export", new Date().toISOString().slice(0, 10)]);
  rows.push(["Devise", currency]);
  rows.push([]);

  rows.push(["SOLDES DE COMPTES"]);
  rows.push(["Mois", "Compte", "Solde"]);
  const accountNames = new Map(data.accounts.map((a) => [a.id, a.name]));
  for (const snapshot of data.accountSnapshots) {
    rows.push([snapshot.month, accountNames.get(snapshot.accountId) ?? "?", money(snapshot.balance)]);
  }
  rows.push([]);

  rows.push(["REVENUS"]);
  rows.push(["Mois", "Source", "Type", "Montant"]);
  const sources = new Map(data.incomeSources.map((s) => [s.id, s]));
  for (const entry of data.incomeEntries) {
    const source = sources.get(entry.sourceId);
    rows.push([
      entry.month,
      source?.name ?? "?",
      source?.kind === "passif" ? "Passif" : "Actif",
      money(entry.amount),
    ]);
  }
  rows.push([]);

  rows.push(["DEPENSES"]);
  rows.push(["Date", "Categorie", "Montant", "Note"]);
  const categories = new Map(data.expenseCategories.map((c) => [c.id, c.label]));
  for (const entry of data.expenseEntries) {
    rows.push([
      entry.date,
      categories.get(entry.categoryId) ?? "Sans categorie",
      money(entry.amount),
      entry.note ?? "",
    ]);
  }
  rows.push([]);

  rows.push(["BIENS DE VALEUR"]);
  rows.push(["Nom", "Categorie", "Prix d'achat", "Valeur actuelle", "Dette", "Entretien"]);
  for (const asset of data.assets) {
    rows.push([
      asset.name,
      asset.category,
      money(asset.purchasePrice),
      money(asset.currentValue),
      money(asset.debt),
      money(asset.maintenanceCost),
    ]);
  }
  rows.push([]);

  rows.push(["PORTEFEUILLE"]);
  rows.push(["Mois", "Classe d'actif", "Montant"]);
  for (const snapshot of data.investmentSnapshots) {
    rows.push([snapshot.month, snapshot.assetClass, money(snapshot.amount)]);
  }

  return toCsv(rows);
}

function minorDigits(currency: CurrencyCode): number {
  return currency === "XOF" || currency === "XAF" ? 0 : 2;
}

/* ------------------------------------------------------------------ *
 * PDF
 * ------------------------------------------------------------------ */

/**
 * Rapport de synthèse en HTML, converti en PDF par `expo-print`.
 *
 * Volontairement sans graphique : les rendre dans un WebView demanderait de
 * réimplémenter les charts en SVG inline, pour un document qu'on regarde une
 * fois. Les chiffres, eux, sont exactement ceux de l'écran — mêmes fonctions
 * de `@mfp/core`.
 */
export function buildReportHtml(data: Dataset): string {
  const currency = data.settings.currency;
  const overview = buildOverview({ ...data, period: "12m" });
  const money = (v: number) => escapeHtml(formatAmount(v, currency));

  const totals = categoryTotals(data.expenseEntries, data.expenseCategories);
  const income = incomeByMonth(data.incomeSources, data.incomeEntries);
  const expenses = expensesByMonth(data.expenseEntries);
  const wealth = wealthSeries(data.accounts, data.accountSnapshots, data.assets);

  const period =
    wealth.length > 0
      ? `${formatMonth(wealth[0]!.month)} — ${formatMonth(wealth.at(-1)!.month)}`
      : "—";

  const kpi = (label: string, value: string) =>
    `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div></div>`;

  const categoryRows = totals
    .map(
      (t) =>
        `<tr><td>${escapeHtml(t.label)}</td><td class="num">${money(t.monthlyAverage)}</td>` +
        `<td class="num">${t.percent.toFixed(1).replace(".", ",")} %</td></tr>`,
    )
    .join("");

  const monthRows = wealth
    .slice(-12)
    .map((point) => {
      const monthIncome = income.find((m) => m.month === point.month)?.total ?? 0;
      const monthExpense = expenses.find((p) => p.month === point.month)?.value ?? 0;
      return (
        `<tr><td>${escapeHtml(formatMonth(point.month))}</td>` +
        `<td class="num">${money(monthIncome)}</td>` +
        `<td class="num">${money(monthExpense)}</td>` +
        `<td class="num">${money(monthIncome - monthExpense)}</td>` +
        `<td class="num">${money(point.value)}</td></tr>`
      );
    })
    .join("");

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Helvetica Neue", Roboto, sans-serif; color: #0B1230; margin: 0; padding: 32px; }
  header { background: linear-gradient(135deg, #0C1740, #16276B 55%, #2B3F9E); color: #fff; padding: 28px; border-radius: 20px; }
  h1 { margin: 0; font-size: 26px; }
  .sub { color: #F7B77A; font-size: 13px; margin-top: 6px; }
  h2 { font-size: 13px; letter-spacing: 1.1px; text-transform: uppercase; color: #5A6488; margin: 32px 0 10px; }
  .kpis { display: flex; gap: 12px; margin-top: 20px; }
  .kpi { flex: 1; background: #EEF1F8; border-radius: 12px; padding: 14px; }
  .kpi-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #5A6488; }
  .kpi-value { font-size: 18px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .8px; color: #5A6488; padding: 8px 6px; border-bottom: 1px solid #DCE2F0; }
  td { padding: 8px 6px; border-bottom: 1px solid #EEF1F8; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  footer { margin-top: 36px; font-size: 11px; color: #5A6488; }
</style></head>
<body>
  <header>
    <h1>Ma Finance Perso</h1>
    <div class="sub">Rapport de synthèse · ${escapeHtml(period)}</div>
  </header>

  <div class="kpis">
    ${kpi("Fortune totale", money(overview.totalWealth))}
    ${kpi("Revenu moyen", money(overview.health.averageIncome))}
    ${kpi("Dépense moyenne", money(overview.health.averageExpense))}
    ${kpi(
      "Santé financière",
      overview.health.runwayYears === null
        ? "—"
        : `${overview.health.runwayYears.toFixed(1).replace(".", ",")} ans`,
    )}
  </div>

  <h2>Douze derniers mois</h2>
  <table>
    <thead><tr><th>Mois</th><th class="num">Revenus</th><th class="num">Dépenses</th><th class="num">Épargne</th><th class="num">Fortune</th></tr></thead>
    <tbody>${monthRows || '<tr><td colspan="5">Aucune donnée</td></tr>'}</tbody>
  </table>

  <h2>Dépenses par catégorie</h2>
  <table>
    <thead><tr><th>Catégorie</th><th class="num">Moyenne / mois</th><th class="num">Part</th></tr></thead>
    <tbody>${categoryRows || '<tr><td colspan="3">Aucune donnée</td></tr>'}</tbody>
  </table>

  <footer>
    Généré le ${escapeHtml(new Date().toLocaleDateString("fr-FR"))} · Hypothèses :
    rendement ${data.settings.expectedReturn} %, retrait ${data.settings.safeWithdrawalRate} %,
    inflation ${data.settings.inflationRate} %.
  </footer>
</body></html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ------------------------------------------------------------------ *
 * Écriture et partage
 * ------------------------------------------------------------------ */

export type ExportResult = { error: string | null };

const stamp = () => new Date().toISOString().slice(0, 10);

/**
 * Écrit le fichier puis ouvre la feuille de partage système.
 *
 * On passe par le partage plutôt que par un « téléchargement » : sur mobile il
 * n'y a pas de dossier Téléchargements commun aux deux plateformes, et ce que
 * l'utilisateur veut faire du fichier (WhatsApp, mail, Drive) est justement ce
 * que la feuille de partage propose.
 */
export async function exportCsv(data: Dataset): Promise<ExportResult> {
  try {
    const file = new FileSystem.File(
      FileSystem.Paths.cache,
      `ma-finance-perso-${stamp()}.csv`,
    );
    if (file.exists) file.delete();
    file.create();
    file.write(buildCsv(data));
    return await share(file.uri, "text/csv", "Exporter les données");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Export impossible." };
  }
}

export async function exportPdf(data: Dataset): Promise<ExportResult> {
  try {
    const { uri } = await Print.printToFileAsync({ html: buildReportHtml(data) });
    return await share(uri, "application/pdf", "Partager le rapport");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Export impossible." };
  }
}

async function share(uri: string, mimeType: string, title: string): Promise<ExportResult> {
  if (!(await Sharing.isAvailableAsync())) {
    return { error: "Le partage n'est pas disponible sur cet appareil." };
  }
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: title, UTI: mimeType });
  return { error: null };
}
