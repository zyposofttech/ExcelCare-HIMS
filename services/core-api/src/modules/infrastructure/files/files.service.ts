import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { promises as fs } from "fs";
import * as path from "path";

import type { UploadResult, StaffAssetKind } from "./files.dto";

function mimeToExt(mime: string): string | null {
  const m = (mime || "").toLowerCase();
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  return null;
}

function assertSafeKey(key: string) {
  // Prevent path traversal and weird control chars.
  if (!key || key.length > 512) throw new BadRequestException("Invalid file key");
  if (key.includes("..")) throw new BadRequestException("Invalid file key");
  if (key.startsWith("/") || key.startsWith("\\")) throw new BadRequestException("Invalid file key");
  if (!/^[a-zA-Z0-9/._-]+$/.test(key)) throw new BadRequestException("Invalid file key");
}

@Injectable()
export class InfraFilesService {
  private readonly uploadsRoot = path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads"));
  private readonly apiPrefix = process.env.API_GLOBAL_PREFIX || "api";

  /**
   * Save a staff onboarding asset (profile photo / signature) to local server storage.
   * Returns a stable key and a URL that the frontend can store in its draft.
   */
  async saveStaffAsset(opts: {
    contextId: string;
    kind: StaffAssetKind;
    file: Express.Multer.File;
  }): Promise<UploadResult> {
    const { contextId, kind, file } = opts;

    if (!file) throw new BadRequestException("file is required");
    const mime = String(file.mimetype || "").toLowerCase();
    const ext = mimeToExt(mime);
    if (!ext) {
      throw new BadRequestException("Only image uploads are allowed (jpg/png/webp)");
    }

    // Size guard (double-check; multer already enforces limits)
    const sizeBytes = Number(file.size || file.buffer?.length || 0);
    if (!sizeBytes || sizeBytes <= 0) throw new BadRequestException("Empty file");
    if (sizeBytes > 5 * 1024 * 1024) throw new BadRequestException("Max file size is 5MB");

    const checksumSha256 = createHash("sha256").update(file.buffer).digest("hex");
    const rand = randomBytes(6).toString("hex");
    const ts = Date.now();

    // Foldering: staff/onboarding/<contextId>/<kind>/<ts>_<rand>.<ext>
    const key = `staff/onboarding/${contextId}/${kind}/${ts}_${rand}.${ext}`;
    assertSafeKey(key);

    const absPath = this.resolveAbsPath(key);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, file.buffer);

    const url = `/${this.apiPrefix}/infrastructure/files/${key}`;
    return { key, url, mime, sizeBytes, checksumSha256 };
  }

  resolveAbsPath(key: string): string {
    assertSafeKey(key);
    const abs = path.resolve(this.uploadsRoot, key);
    const root = this.uploadsRoot.endsWith(path.sep) ? this.uploadsRoot : this.uploadsRoot + path.sep;
    if (!abs.startsWith(root)) throw new BadRequestException("Invalid file key");
    return abs;
  }

  async readFile(key: string): Promise<{ absPath: string; mimeGuess: string | null }> {
    const absPath = this.resolveAbsPath(key);
    try {
      const st = await fs.stat(absPath);
      if (!st.isFile()) throw new NotFoundException("File not found");
    } catch {
      throw new NotFoundException("File not found");
    }

    const ext = path.extname(absPath).replace(".", "").toLowerCase();
    const mimeGuess =
      ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : ext === "png"
          ? "image/png"
          : ext === "webp"
            ? "image/webp"
            : null;

    return { absPath, mimeGuess };
  }
}
