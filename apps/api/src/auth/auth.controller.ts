import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { AuthService, type Tokens } from "./auth.service";
import { CredentialsDto, LoginDto, RefreshDto } from "./auth.dto";
import { Public } from "./public.decorator";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("register")
  register(@Body() dto: CredentialsDto): Promise<Tokens> {
    return this.auth.register(dto.email, dto.password);
  }

  @Public()
  @HttpCode(200)
  @Post("login")
  login(@Body() dto: LoginDto): Promise<Tokens> {
    return this.auth.login(dto.email, dto.password);
  }

  @Public()
  @HttpCode(200)
  @Post("refresh")
  refresh(@Body() dto: RefreshDto): Promise<Tokens> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @HttpCode(204)
  @Post("logout")
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }
}
