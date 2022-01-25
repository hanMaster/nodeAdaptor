import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom, map } from 'rxjs';
import { AddressEntity } from './interfaces/address-entity.interface';
import { SignatureDto } from './interfaces/signatureDto.interface';
import { DepositsDto } from "./interfaces/depositsDto.interface";

@Injectable()
export class AppService {
  constructor(private httpService: HttpService) {}

  async getDeposits(adresses: AddressEntity[]): Promise<DepositsDto[]> {
    let hashList: DepositsDto[] = [];
    for (const addr of adresses) {
      const list = await this.getSignaturesForAddress(addr);
      if (list && list.length){
        hashList.push({
          address: addr.address,
          hashes: list
        });
      }
    }
    return hashList;
  }

  async getSignaturesForAddress(addr: AddressEntity) {
    const method = 'getSignaturesForAddress';
    const limit = 100;
    const until = addr.cursor;
    const params = [ addr.address, until ? { limit, until } : {limit} ];
    const body = { jsonrpc: '2.0', id: 123, method, params };
    let data = await lastValueFrom(
      this.httpService.post('/', body).pipe(map((resp) => resp.data)),
    );
    if (data.jsonrpc === '2.0' && data.id === 123 && data.result) {
      data = data.result.map((item: SignatureDto) => item.signature);
    }
    return data;
  }
}
