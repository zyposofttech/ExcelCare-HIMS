import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  Get,
  Param,
  Res,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import * as fs from "fs";
import * as path from "path";

function safeName(original: string) {
  return original.replace(/[^a-zA-Z0-9._-]/g, "_");
}

@Controller(["infrastructure/files", "infra/files"])
export class FilesController {
  @Post("upload")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = path.join(process.cwd(), "uploads");
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const key =
            Date.now() +
            "_" +
            Math.random().toString(16).slice(2, 8) +
            "_" +
            safeName(file.originalname);

          cb(null, key);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    return {
      url: `/api/infrastructure/files/${encodeURIComponent(file.filename)}`,
      fileName: file.originalname,
      mime: file.mimetype,
      sizeBytes: file.size,
      contextId: body?.contextId ?? null,
      kind: body?.kind ?? null,
    };
  }

  @Get(":fileKey")
  async getFile(@Param("fileKey") fileKey: string, @Res() res: any) {
    const decoded = decodeURIComponent(fileKey);
    const full = path.join(process.cwd(), "uploads", decoded);

    if (!fs.existsSync(full)) {
      return res.status(404).send({ message: "File not found" });
    }

    return res.sendFile(full);
  }
}
