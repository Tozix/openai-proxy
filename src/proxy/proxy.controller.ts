import { All, Controller, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyService } from './proxy.service';

@Controller('v1')
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @All()
  proxyV1(@Req() req: Request, @Res() res: Response): void {
    this.proxyService.proxy(req, res);
  }

  @All('*')
  proxyV1One(@Req() req: Request, @Res() res: Response): void {
    this.proxyService.proxy(req, res);
  }

  @All('*/*')
  proxyV1Two(@Req() req: Request, @Res() res: Response): void {
    this.proxyService.proxy(req, res);
  }

  @All('*/*/*')
  proxyV1Three(@Req() req: Request, @Res() res: Response): void {
    this.proxyService.proxy(req, res);
  }

  @All('*/*/*/*')
  proxyV1Four(@Req() req: Request, @Res() res: Response): void {
    this.proxyService.proxy(req, res);
  }

  @All('*/*/*/*/*')
  proxyV1Five(@Req() req: Request, @Res() res: Response): void {
    this.proxyService.proxy(req, res);
  }
}
