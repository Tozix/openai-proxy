import { All, Controller, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyService } from './proxy.service';

@Controller('kie')
export class KieController {
  constructor(private readonly proxyService: ProxyService) {}

  @All()
  proxyKie(@Req() req: Request, @Res() res: Response): void {
    this.proxyService.proxyToKie(req, res);
  }

  @All('*')
  proxyKieOne(@Req() req: Request, @Res() res: Response): void {
    this.proxyService.proxyToKie(req, res);
  }

  @All('*/*')
  proxyKieTwo(@Req() req: Request, @Res() res: Response): void {
    this.proxyService.proxyToKie(req, res);
  }

  @All('*/*/*')
  proxyKieThree(@Req() req: Request, @Res() res: Response): void {
    this.proxyService.proxyToKie(req, res);
  }

  @All('*/*/*/*')
  proxyKieFour(@Req() req: Request, @Res() res: Response): void {
    this.proxyService.proxyToKie(req, res);
  }

  @All('*/*/*/*/*')
  proxyKieFive(@Req() req: Request, @Res() res: Response): void {
    this.proxyService.proxyToKie(req, res);
  }
}
