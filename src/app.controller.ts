import { Body, Controller, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { DepositsRequestDto } from './interfaces/deposits-request-dto.interface';
import { DepositsResponseDto } from "./interfaces/deposits-response-dto.interface";
import { BalancesRequestDto } from "./interfaces/balances-request-dto.interface";
import { BalancesResponseDto } from "./interfaces/balances-response-dto.interface";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('deposits')
  async getDeposits(@Body() body: DepositsRequestDto): Promise<DepositsResponseDto[]> {
    return this.appService.getDeposits(body.addresses);
  }

  @Post('balances')
  async getBalances(@Body() body: BalancesRequestDto): Promise<BalancesResponseDto> {
    return this.appService.getBalances(body);
  }
}
