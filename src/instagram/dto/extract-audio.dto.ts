import { IsNotEmpty, IsUrl } from "class-validator";

export class ExtractAudioDTO {
  @IsNotEmpty({ message: 'A URL do post é obrigatória' })
  @IsUrl({}, { message: 'Forneça uma URL válida' })
  postUrl!: string;
}