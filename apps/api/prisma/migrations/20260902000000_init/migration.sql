-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('liquide', 'compte', 'epargne', 'investissement');

-- CreateEnum
CREATE TYPE "IncomeKind" AS ENUM ('passif', 'actif');

-- CreateEnum
CREATE TYPE "GoalKind" AS ENUM ('fortune', 'revenu_passif');

-- CreateEnum
CREATE TYPE "GoalHorizon" AS ENUM ('court', 'moyen', 'long', 'minimum', 'ideal');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "birthDate" TEXT,
    "safeWithdrawalRate" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "inflationRate" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "expectedReturn" DOUBLE PRECISION NOT NULL DEFAULT 7,
    "monthlyInvestment" BIGINT NOT NULL DEFAULT 0,
    "averageWindowMonths" INTEGER NOT NULL DEFAULT 6,
    "driftThreshold" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "lifeExpectancy" INTEGER NOT NULL DEFAULT 80,
    "inheritanceTargetAge" INTEGER NOT NULL DEFAULT 90,
    "biometricLock" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "AccountKind" NOT NULL DEFAULT 'compte',
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "position" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "balance" BIGINT NOT NULL,
    "note" TEXT,

    CONSTRAINT "account_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_sources" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "IncomeKind" NOT NULL,
    "isInvestment" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "income_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "amount" BIGINT NOT NULL,
    "note" TEXT,

    CONSTRAINT "income_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "spentOn" DATE NOT NULL,
    "amount" BIGINT NOT NULL,
    "note" TEXT,
    "receiptId" TEXT,

    CONSTRAINT "expense_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purchaseDate" DATE,
    "purchasePrice" BIGINT NOT NULL DEFAULT 0,
    "debt" BIGINT NOT NULL DEFAULT 0,
    "maintenanceCost" BIGINT NOT NULL DEFAULT 0,
    "currentValue" BIGINT NOT NULL DEFAULT 0,
    "conditionScore" INTEGER,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_valuations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "valuedOn" DATE NOT NULL,
    "value" BIGINT NOT NULL,

    CONSTRAINT "asset_valuations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_targets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetClass" TEXT NOT NULL,
    "targetPercent" DOUBLE PRECISION NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "investment_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetClass" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "amount" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "investment_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "GoalKind" NOT NULL,
    "horizon" "GoalHorizon" NOT NULL,
    "label" TEXT NOT NULL,
    "targetAmount" BIGINT NOT NULL,

    CONSTRAINT "financial_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "savings_actions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "feasible" BOOLEAN NOT NULL DEFAULT true,
    "initialExpense" BIGINT NOT NULL DEFAULT 0,
    "newExpense" BIGINT NOT NULL DEFAULT 0,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "savings_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE INDEX "account_snapshots_userId_month_idx" ON "account_snapshots"("userId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "account_snapshots_accountId_month_key" ON "account_snapshots"("accountId", "month");

-- CreateIndex
CREATE INDEX "income_sources_userId_idx" ON "income_sources"("userId");

-- CreateIndex
CREATE INDEX "income_entries_userId_month_idx" ON "income_entries"("userId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "income_entries_sourceId_month_key" ON "income_entries"("sourceId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_userId_key_key" ON "expense_categories"("userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "expense_entries_receiptId_key" ON "expense_entries"("receiptId");

-- CreateIndex
CREATE INDEX "expense_entries_userId_spentOn_idx" ON "expense_entries"("userId", "spentOn");

-- CreateIndex
CREATE INDEX "expense_entries_categoryId_idx" ON "expense_entries"("categoryId");

-- CreateIndex
CREATE INDEX "receipts_userId_idx" ON "receipts"("userId");

-- CreateIndex
CREATE INDEX "assets_userId_idx" ON "assets"("userId");

-- CreateIndex
CREATE INDEX "asset_valuations_userId_idx" ON "asset_valuations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "asset_valuations_assetId_valuedOn_key" ON "asset_valuations"("assetId", "valuedOn");

-- CreateIndex
CREATE UNIQUE INDEX "investment_targets_userId_assetClass_key" ON "investment_targets"("userId", "assetClass");

-- CreateIndex
CREATE INDEX "investment_snapshots_userId_month_idx" ON "investment_snapshots"("userId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "investment_snapshots_userId_assetClass_month_key" ON "investment_snapshots"("userId", "assetClass", "month");

-- CreateIndex
CREATE UNIQUE INDEX "financial_goals_userId_kind_horizon_key" ON "financial_goals"("userId", "kind", "horizon");

-- CreateIndex
CREATE INDEX "savings_actions_userId_idx" ON "savings_actions"("userId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_snapshots" ADD CONSTRAINT "account_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_snapshots" ADD CONSTRAINT "account_snapshots_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_sources" ADD CONSTRAINT "income_sources_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_entries" ADD CONSTRAINT "income_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_entries" ADD CONSTRAINT "income_entries_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "income_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_entries" ADD CONSTRAINT "expense_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_entries" ADD CONSTRAINT "expense_entries_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_entries" ADD CONSTRAINT "expense_entries_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_valuations" ADD CONSTRAINT "asset_valuations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_valuations" ADD CONSTRAINT "asset_valuations_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_targets" ADD CONSTRAINT "investment_targets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_snapshots" ADD CONSTRAINT "investment_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_goals" ADD CONSTRAINT "financial_goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_actions" ADD CONSTRAINT "savings_actions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
