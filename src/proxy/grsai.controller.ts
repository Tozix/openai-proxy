import { All, Controller, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyService } from './proxy.service';

@Controller('grsai')
export class GrsaiController {
  constructor(private readonly proxyService: ProxyService) {}

  @All()
  proxyGrsai(@Req() req: Request, @Res() res: Response): void {
    this.proxyService.proxyToGrsai(req, res);
  }

  @All('*')
  proxyGrsaiOne(@Req() req: Request, @Res() res: Response): void {
    this.proxyService.proxyToGrsai(req, res);
  }

  @All('*/*')
  proxyGrsaiTwo(@Req() req: Request, @Res() res: Response): void {
    this.proxyService.proxyToGrsai(req, res);
  }

  @All('*/*/*')
  proxyGrsaiThree(@Req() req: Request, @Res() res: Response): void {
    this.proxyService.proxyToGrsai(req, res);
  }

  @All('*/*/*/*')
  proxyGrsaiFour(@Req() req: Request, @Res() res: Response): void {
    this.proxyService.proxyToGrsai(req, res);
  }

  @All('*/*/*/*/*')
  proxyGrsaiFive(@Req() req: Request, @Res() res: Response): void {
    this.proxyService.proxyToGrsai(req, res);
  }
}
