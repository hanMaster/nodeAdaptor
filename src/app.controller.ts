import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { AddressesDto } from './interfaces/addresses-dto.interface';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('deposits')
  async getDeposits(@Body() body: AddressesDto): Promise<string[]> {
    return this.appService.getDeposits(body.addresses);
  }
}
