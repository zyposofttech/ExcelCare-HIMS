import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { Response } from "express";

import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";

import { UploadStaffAssetDto } from "./files.dto";
import { InfraFilesService } from "./files.service";

@Controller(["infrastructure", "infra"])
export class InfraFilesController {
  constructor(private readonly files: InfraFilesService) {}

  /**
   * Upload staff assets (profile photo / signature) and get a URL back.
   *
   * POST /api/infrastructure/files/upload
   * Multipart form-data: file, contextId, kind
   */
  @Post("files/upload")
  @Permissions(PERM.STAFF_CREATE)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const mime = String(file.mimetype || "").toLowerCase();
        if (["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(mime)) return cb(null, true);
        return cb(new BadRequestException("Only image uploads are allowed (jpg/png/webp)"), false);
      },
    }),
  )
  async uploadStaffAsset(@Body() body: UploadStaffAssetDto, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException("file is required");
    return this.files.saveStaffAsset({ contextId: body.contextId, kind: body.kind, file });
  }

  /**
   * Serve uploaded files from local storage.
   *
   * GET /api/infrastructure/files/<key>
   */
  @Get("files/:key(*)")
  @Permissions(PERM.STAFF_READ)
  async getFile(@Param("key") key: string, @Res() res: Response) {
    const { absPath, mimeGuess } = await this.files.readFile(key);
    if (mimeGuess) res.type(mimeGuess);
    return res.sendFile(absPath);
  }
}
