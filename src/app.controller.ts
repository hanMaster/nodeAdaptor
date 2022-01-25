import { Body, Controller, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { AddressesDto } from './interfaces/addresses-dto.interface';
import { DepositsDto } from "./interfaces/depositsDto.interface";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('deposits')
  async getDeposits(@Body() body: AddressesDto): Promise<DepositsDto[]> {
    return this.appService.getDeposits(body.addresses);
  }
}
