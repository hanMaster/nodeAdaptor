import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom, map } from 'rxjs';
import { AddressEntity } from './interfaces/address-entity.interface';
import { SignatureDto } from './interfaces/signatureDto.interface';
import { DepositsResponseDto } from './interfaces/deposits-response-dto.interface';
import { BalancesRequestDto } from './interfaces/balances-request-dto.interface';
import BigNumber from 'bignumber.js';
import { BalancesResponseDto } from "./interfaces/balances-response-dto.interface";
import { BalancesAndAddressesResponseDto } from './interfaces/balances-and-addresses-response-dto.interface';

@Injectable()
export class AppService {
  constructor(private httpService: HttpService) {}

  async getDeposits(addresses: AddressEntity[]): Promise<DepositsResponseDto[]> {
    let hashList: DepositsResponseDto[] = [];
    const total = addresses.length;
    const start = process.hrtime();
    while (addresses.length) {
      const batch = addresses.splice(0, 10000);
      const promises = [];
      for (const adr of batch) {
        promises.push(this.getSignaturesForAddress(adr, hashList));
      }
      const whileStart = process.hrtime();
      await Promise.all(promises);
      const whileEnd = process.hrtime(whileStart);
      console.log(`[getDeposits] batch: ${batch.length} done for ${whileEnd[0]} sec`);
      await this.setImmediatePromise();
    }
    const end = process.hrtime(start);
    console.log(`[getDeposits] TOTAL: ${total} done for ${end[0]} sec`);

    return hashList;
  }

  async getSignaturesForAddress(addr: AddressEntity, hashList: DepositsResponseDto[]) {
    const method = 'getSignaturesForAddress';
    const limit = 100;
    const until = addr.cursor;
    const params = [addr.address, until ? { limit, until } : { limit }];
    const body = { jsonrpc: '2.0', id: 123, method, params };
    let data = await lastValueFrom(
      this.httpService.post('/', body).pipe(map((resp) => resp.data)),
    );
    if (data.jsonrpc === '2.0' && data.id === 123 && data.result) {
      const sorted = data.result.sort((t1, t2) => t1.slot - t2.slot);
      data = sorted.map((item: SignatureDto) => item.signature);
    }
    if (data && data.length) {
      hashList.push({
        address: addr.address,
        hashes: data,
      });
    }
  }

  async getBalances(body: BalancesRequestDto): Promise<BalancesResponseDto> {
    const { addresses, tokenId } = body;
    const balanceSum =  tokenId ? await this.getTokenBalances(body) : await this.getSolBalances(addresses);
    console.log(`Balance: ${balanceSum}`);
    return { balanceSum };
  }

  private async getSolBalances(addresses: string[]): Promise<number> {
    let balance = new BigNumber('0');
    for (const address of addresses) {
      const data = await this.request('getBalance', [address]);
      if (data) {
        balance = balance.plus(new BigNumber(data.value));
      }
    }
    // decimals === 9 for SOL
    return balance.dividedBy(10 ** 9).toNumber();
  }

  private async getTokenBalances(body: BalancesRequestDto): Promise<number> {
    const decimals = await this.getDecimals(body.tokenId);
    console.log(`[getTokenBalances] tokenId: ${body.tokenId} decimals: ${decimals}`);

    const promises = [];
    for (const address of body.addresses) {
      promises.push(this.getTokenBalanceForAddress(address, body.tokenId));
    }
    const start = process.hrtime();
    const response = await Promise.all(promises);
    const end = process.hrtime(start);


    const balances = response.map((nativeBalance: BigNumber) =>
      Number(nativeBalance.dividedBy(10 ** decimals)),
    );
    const balancesSum = balances.reduce((acc: number, cur: number) => acc + cur, 0);
    console.log(`TokenId: ${body.tokenId} balances requested in ${end[0]} seconds balancesSum: ${balancesSum}`);
    return balancesSum;
  }

  async getBalancesWithAddresses(body: BalancesRequestDto): Promise<BalancesAndAddressesResponseDto> {
    const { addresses, tokenId } = body;
    const { balanceSum, addressMap } = tokenId ? await this.getTokenBalancesWithAddresses(body) : await this.getSolBalancesWithAddresses(addresses);
    console.log(`Balance: ${balanceSum}, addressMap: ${[...addressMap]}`);
    return { balanceSum, addressMap };
  }

  private async getSolBalancesWithAddresses(addresses: string[]): Promise<BalancesAndAddressesResponseDto> {
    let balance = new BigNumber('0');
    const addressMap = new Map<string, number>();
    for (const address of addresses) {
      const data = await this.request('getBalance', [address]);
      if (data) {
        addressMap.set(address, data.value);
        balance = balance.plus(new BigNumber(data.value));
      }
    }
    // decimals === 9 for SOL
    const balanceSum = balance.dividedBy(10 ** 9).toNumber()
    return { balanceSum, addressMap }
  }

  private async getTokenBalancesWithAddresses(body: BalancesRequestDto): Promise<BalancesAndAddressesResponseDto> {
    const decimals = await this.getDecimals(body.tokenId);
    console.log(`[getTokenBalances] tokenId: ${body.tokenId} decimals: ${decimals}`);

    const promises = [];
    const addressMap = new Map<string, number>();
    for (const address of body.addresses) {
      promises.push(this.getTokenBalanceForAddress(address, body.tokenId));
    }
    const start = process.hrtime();
    const response = await Promise.all(promises);
    const end = process.hrtime(start);


    const balances:number[] = [];
      response.map((nativeBalance: BigNumber, index) => {
        const balance = Number(nativeBalance.dividedBy(10 ** decimals));
        balances.push(balance);
        addressMap.set(body.addresses[index], balance);
      }
    );
    const balanceSum = balances.reduce((acc: number, cur: number) => acc + cur, 0);
    console.log(`TokenId: ${body.tokenId} balances requested in ${end[0]} seconds balancesSum: ${balanceSum}`);
    return { balanceSum, addressMap };
  }

  private async request(method: string, params: any[]) {
    let data;
    const body = { jsonrpc: '2.0', id: 123, method, params };
    let response = await lastValueFrom(
      this.httpService.post('/', body, {timeout: 200000}).pipe(map((resp) => resp.data)),
    );
    if (response.id === 123 && response.result) {
      data = response.result;
    }
    return data;
  }

  private async getDecimals(tokenId: string): Promise<number> {
    const response = await this.request('getTokenSupply', [tokenId]);
    if (response && response.value) {
      return Number(response.value.decimals);
    } else {
      throw new Error('Unable to get token supply');
    }
  }

  private async getTokenBalanceForAddress(
    address: string,
    tokenId: string,
  ): Promise<BigNumber> {
    let balance = new BigNumber('0');
    const response = await this.request('getTokenAccountsByOwner', [
      address,
      { mint: tokenId },
      { encoding: 'jsonParsed' },
    ]);
    if (response && response.value.length) {
      balance = new BigNumber(
        response.value[0].account.data.parsed.info.tokenAmount.amount,
      );
    }
    return balance;
  }

  private setImmediatePromise() {
    return new Promise((resolve) => {
      setImmediate(resolve);
    });
  }
}
