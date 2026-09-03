import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

/** « 2026-08 ». */
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
/** « 2026-08-14 ». */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Borne haute des montants : 2^53 − 1, la limite d'un entier sûr en JavaScript.
 * Au-delà, la valeur perdrait en précision côté client sans que rien ne le
 * signale — un solde afficherait un chiffre faux.
 */
const MAX_AMOUNT = Number.MAX_SAFE_INTEGER;

/** Taille des lots. Bornée pour qu'une requête ne puisse pas saturer la base. */
const MAX_BATCH = 200;

export class AddExpenseDto {
  @IsString() categoryId!: string;

  @Matches(DAY, { message: "Date attendue au format AAAA-MM-JJ." })
  spentOn!: string;

  @IsInt() @Min(0) @Max(MAX_AMOUNT) amount!: number;

  @IsOptional() @IsString() @MaxLength(500) note?: string;

  /** Identifiant d'un reçu déjà téléversé par `POST /receipts`. */
  @IsOptional() @IsString() receiptId?: string;
}

export class SetIncomeDto {
  @IsString() sourceId!: string;
  @Matches(MONTH) month!: string;
  @IsInt() @Min(0) @Max(MAX_AMOUNT) amount!: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class BalanceDto {
  @IsString() accountId!: string;
  @IsInt() @Min(-MAX_AMOUNT) @Max(MAX_AMOUNT) balance!: number;
}

export class SetBalancesDto {
  @Matches(MONTH) month!: string;

  @IsArray()
  @ArrayMaxSize(MAX_BATCH)
  @ValidateNested({ each: true })
  @Type(() => BalanceDto)
  balances!: BalanceDto[];
}

export class InvestmentAmountDto {
  @IsString() @MaxLength(60) assetClass!: string;
  @IsInt() @Min(0) @Max(MAX_AMOUNT) amount!: number;
}

export class SetInvestmentsDto {
  @Matches(MONTH) month!: string;

  @IsArray()
  @ArrayMaxSize(MAX_BATCH)
  @ValidateNested({ each: true })
  @Type(() => InvestmentAmountDto)
  amounts!: InvestmentAmountDto[];
}

export class SetAssetValueDto {
  @IsInt() @Min(0) @Max(MAX_AMOUNT) value!: number;
}

export class UpsertGoalDto {
  @IsIn(["fortune", "revenu_passif"]) kind!: "fortune" | "revenu_passif";

  @IsIn(["court", "moyen", "long", "minimum", "ideal"])
  horizon!: "court" | "moyen" | "long" | "minimum" | "ideal";

  @IsString() @MaxLength(120) label!: string;

  // Strictement positif : un objectif à zéro est déjà atteint, il n'a pas de sens.
  @IsInt() @Min(1) @Max(MAX_AMOUNT) targetAmount!: number;
}

export class ToggleSavingsDto {
  @IsBoolean() done!: boolean;
}

export class TargetDto {
  @IsString() @MaxLength(60) assetClass!: string;
  @IsNumber() @Min(0) @Max(100) targetPercent!: number;
}

export class SetTargetsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TargetDto)
  targets!: TargetDto[];
}

/**
 * Réglages. Tous les champs sont optionnels — l'écran envoie une modification
 * partielle (un seul interrupteur, par exemple).
 */
export class UpdateSettingsDto {
  @IsOptional() @IsIn(["XOF", "XAF", "EUR", "USD", "MAD", "CAD", "GBP"]) currency?: string;

  @IsOptional()
  @Matches(DAY, { message: "Date de naissance attendue au format AAAA-MM-JJ." })
  birthDate?: string | null;

  @IsOptional() @IsNumber() @Min(0) @Max(20) safeWithdrawalRate?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(50) inflationRate?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(50) expectedReturn?: number;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_AMOUNT) monthlyInvestment?: number;
  @IsOptional() @IsInt() @Min(1) @Max(60) averageWindowMonths?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) driftThreshold?: number;
  @IsOptional() @IsInt() @Min(1) @Max(130) lifeExpectancy?: number;
  @IsOptional() @IsInt() @Min(1) @Max(130) inheritanceTargetAge?: number;
  @IsOptional() @IsBoolean() biometricLock?: boolean;
}
