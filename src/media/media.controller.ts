import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { MediaService } from "./media.service";
import { diskStorage } from "multer";
import * as path from 'path';
import * as fs from 'fs';

const tempDir = path.resolve(__dirname, '../../temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) { }

  @Post('extract-audio')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: tempDir,
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() + 1E9);
        cb(null, `video_${uniqueSuffix}${path.extname(file.originalname)}`);
      }
    })
  }))
  async extractAudio(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Nenhum arquivo de vídeo foi enviado.')

    return this.mediaService.processVideoAndUploadAudio(file)
  }
}