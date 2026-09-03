import { Body, Controller, Delete, HttpCode, Param, Patch, Post, Put } from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator";
import { DataService } from "./data.service";
import {
  AddExpenseDto,
  SetAssetValueDto,
  SetBalancesDto,
  SetIncomeDto,
  SetInvestmentsDto,
  SetTargetsDto,
  ToggleSavingsDto,
  UpdateSettingsDto,
  UpsertGoalDto,
} from "./data.dto";

/**
 * Ecritures. Chaque route reçoit le `userId` du JWT via `@CurrentUser()` —
 * jamais du corps ni de l'URL (cf. l'en-tete de `DataService`).
 */
@Controller()
export class DataController {
  constructor(private readonly data: DataService) {}

  @Post("expenses")
  addExpense(@CurrentUser() userId: string, @Body() dto: AddExpenseDto) {
    return this.data.addExpense(userId, dto);
  }

  @HttpCode(204)
  @Delete("expenses/:id")
  deleteExpense(@CurrentUser() userId: string, @Param("id") id: string) {
    return this.data.deleteExpense(userId, id);
  }

  @HttpCode(204)
  @Put("income")
  setIncome(@CurrentUser() userId: string, @Body() dto: SetIncomeDto) {
    return this.data.setIncome(userId, dto);
  }

  @HttpCode(204)
  @Put("balances")
  setBalances(@CurrentUser() userId: string, @Body() dto: SetBalancesDto) {
    return this.data.setBalances(userId, dto);
  }

  @HttpCode(204)
  @Put("investments")
  setInvestments(@CurrentUser() userId: string, @Body() dto: SetInvestmentsDto) {
    return this.data.setInvestments(userId, dto);
  }

  @HttpCode(204)
  @Put("targets")
  setTargets(@CurrentUser() userId: string, @Body() dto: SetTargetsDto) {
    return this.data.setTargets(userId, dto);
  }

  @HttpCode(204)
  @Patch("assets/:id/value")
  setAssetValue(
    @CurrentUser() userId: string,
    @Param("id") id: string,
    @Body() dto: SetAssetValueDto,
  ) {
    return this.data.setAssetValue(userId, id, dto);
  }

  @HttpCode(204)
  @Put("goals")
  upsertGoal(@CurrentUser() userId: string, @Body() dto: UpsertGoalDto) {
    return this.data.upsertGoal(userId, dto);
  }

  @HttpCode(204)
  @Delete("goals/:id")
  deleteGoal(@CurrentUser() userId: string, @Param("id") id: string) {
    return this.data.deleteGoal(userId, id);
  }

  @HttpCode(204)
  @Patch("savings/:id")
  toggleSavings(
    @CurrentUser() userId: string,
    @Param("id") id: string,
    @Body() dto: ToggleSavingsDto,
  ) {
    return this.data.toggleSavings(userId, id, dto);
  }

  @HttpCode(204)
  @Patch("settings")
  updateSettings(@CurrentUser() userId: string, @Body() dto: UpdateSettingsDto) {
    return this.data.updateSettings(userId, dto);
  }
}
