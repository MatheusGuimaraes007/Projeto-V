import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import ffmpeg from 'fluent-ffmpeg';

@Injectable()
export class InstagramService {
  constructor(private readonly prisma: PrismaService) { }

  async processVideoAndExtractAudio(postUrl: string) {
    console.log(`Iniciando processamento para: ${postUrl}`);

    const videoUrl = await this.scrapeInstagramVideoUrl(postUrl);
    if (!videoUrl) {
      throw new BadRequestException('Não foi possível encontrar um video público para o post fornecido. Verifique a URL e tente novamente.');
    }
    console.log('Vídeo encontrado! Preparando Download');

    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const timestamp = Date.now();
    const videoPath = path.join(tempDir, `video_${timestamp}.mp4`);
    const audioPath = path.join(tempDir, `audio_${timestamp}.mp3`);

    try {
      console.log('Baixando vídeo...');
      await this.downloadFile(videoUrl, videoPath);

      console.log('Extraindo o áudio com FFmpeg...');
      await this.extractAudio(videoPath, audioPath);

      fs.unlinkSync(videoPath);
      console.log('Vídeo apagado, MP3 salvo com sucesso');

      return {
        status: 'success',
        message: 'Áudio extraído com sucesso',
        audioPath: audioPath
      }
    } catch (error) {
      console.error('Erro no processo de mídia: ', error);
      throw new InternalServerErrorException('Ocorreu um erro ao processar o vídeo. Tente novamente mais tarde.');
    }

  }

  private async scrapeInstagramVideoUrl(url: string): Promise<string | null> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': '*/*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
        }
      })
      if (!response.ok) return null;
      const html = await response.text();
      const $ = cheerio.load(html);

      const videoElement = $('meta[property="og:video"]');
      return videoElement.length > 0 ? videoElement.attr('content') || null : null;
    } catch (error) {
      return null;
    }
  }

  private async downloadFile(url: string, outputPath: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok || !response.body) throw new Error('Falha no download do vídeo');

    const fileStream = fs.createWriteStream(outputPath);
    const nodeStream = Readable.fromWeb(response.body as any);
    nodeStream.pipe(fileStream);

    await finished(fileStream);
  }

  private extractAudio(videoPath: string, audioPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath).noVideo().audioCodec('libmp3lame').audioBitrate(128).on('end', () => resolve()).on('error', (err) => reject(err)).save(audioPath)

    })
  }
}
