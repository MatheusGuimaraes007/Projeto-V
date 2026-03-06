import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import * as fs from 'fs';
import * as path from 'path';
import ffmpeg from "fluent-ffmpeg";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class MediaService {
  private supabase: SupabaseClient;

  constructor(private readonly prisma: PrismaService) {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_KEY || ''
    )
  }

  async processVideoAndUploadAudio(file: Express.Multer.File) {
    const videoPath = file.path;
    const audioFileName = `audio_${Date.now()}.mp3`;
    const audioPath = path.join(path.dirname(videoPath), audioFileName);

    try {
      console.log('1. Extraindo áudio com ffmpeg...');
      await this.extractAudio(videoPath, audioPath);

      console.log('2. Fazendo upload do áudio para o Supabase Storage...');
      const audioBuffer = fs.readFileSync(audioPath);

      const { data, error } = await this.supabase.storage.from('audios').upload(audioFileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true
      });

      if (error) throw new Error(`Erro no upload no Supabase: ${error.message}`)

      console.log('3. Obtendo URL Pública do arquivo...');
      const { data: publicUrlData } = this.supabase.storage.from('audios').getPublicUrl(audioFileName);

      console.log('4. Limpando os arquivos temporários do servidor local...');
      fs.unlinkSync(videoPath);
      fs.unlinkSync(audioPath);

      return {
        status: 'success',
        message: 'Áudio extraído e salvo na nuvem com sucesso!',
        audioUrl: publicUrlData.publicUrl
      }

    } catch (error) {
      console.error('Erro no processamento de mídia:', error);

      if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);

      throw new InternalServerErrorException('Erro durante o processamento do vídeo.');
    }

  }

  private extractAudio(videoPath: string, audioPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioBitrate(128)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .save(audioPath);
    })
  }

}