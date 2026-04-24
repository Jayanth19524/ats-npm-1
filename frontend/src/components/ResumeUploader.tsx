import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface ResumeUploaderProps {
  value: string;
  onChange: (url: string, upload?: ResumeUploadResult | null) => void;
}

export interface ResumeUploadResult {
  url: string;
  key: string;
  filename: string;
  size: number;
  mimeType: string;
}

interface ResumePresignResult extends ResumeUploadResult {
  strategy: "s3";
  uploadUrl: string;
  headers: Record<string, string>;
  expiresInSeconds: number;
}

export function ResumeUploader({ value, onChange }: ResumeUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [filename, setFilename] = useState<string | null>(null);

  function inferMimeType(file: File): string {
    if (file.type) return file.type;

    const extension = file.name.toLowerCase().split(".").pop();
    switch (extension) {
      case "pdf":
        return "application/pdf";
      case "doc":
        return "application/msword";
      case "docx":
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      case "rtf":
        return "application/rtf";
      case "txt":
        return "text/plain";
      default:
        return "";
    }
  }

  async function readFileHead(file: File): Promise<Uint8Array> {
    const buffer = await file.slice(0, 512).arrayBuffer();
    return new Uint8Array(buffer);
  }

  function startsWithBytes(buffer: Uint8Array, bytes: number[]): boolean {
    return bytes.every((byte, index) => buffer[index] === byte);
  }

  function looksLikeText(buffer: Uint8Array): boolean {
    if (buffer.includes(0)) return false;
    return !new TextDecoder("utf-8", { fatal: false }).decode(buffer).includes("\uFFFD");
  }

  async function validateResumeContent(file: File, mimeType: string): Promise<void> {
    const head = await readFileHead(file);
    const asText = new TextDecoder("utf-8", { fatal: false }).decode(head).trimStart();
    const isZip = startsWithBytes(head, [0x50, 0x4b]);
    const isOleDoc = startsWithBytes(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

    const ok =
      (mimeType === "application/pdf" && new TextDecoder("ascii").decode(head.slice(0, 5)) === "%PDF-") ||
      (mimeType === "application/msword" && isOleDoc) ||
      (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && isZip) ||
      (mimeType === "application/rtf" && asText.startsWith("{\\rtf")) ||
      (mimeType === "text/plain" && looksLikeText(head));

    if (!ok) {
      throw new Error("The uploaded file content does not match its file type.");
    }
  }

  async function uploadViaBackend(file: File, mimeType: string): Promise<ResumeUploadResult> {
    const fd = new FormData();
    const uploadFile = file.type === mimeType ? file : new File([file], file.name, { type: mimeType });
    fd.append("file", uploadFile);
    const res = await fetch("/api/uploads/resume", {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Upload failed");
    }
    return res.json() as Promise<ResumeUploadResult>;
  }

  async function handleFile(file: File) {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("File is larger than 8 MB");
      return;
    }
    setUploading(true);
    try {
      const mimeType = inferMimeType(file);
      await validateResumeContent(file, mimeType);

      const presignRes = await fetch("/api/uploads/resume/presign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name,
          mimeType,
          size: file.size,
        }),
      });
      if (!presignRes.ok) {
        const body = await presignRes.json().catch(() => ({}));
        throw new Error(body.error || "Upload failed");
      }

      const presignBody = (await presignRes.json()) as ResumePresignResult | { strategy: "local" };
      const data =
        presignBody.strategy === "local"
          ? await uploadViaBackend(file, mimeType)
          : await (async () => {
              const uploadRes = await fetch(presignBody.uploadUrl, {
                method: "PUT",
                headers: presignBody.headers,
                body: file,
              });

              if (!uploadRes.ok) {
                throw new Error("Upload to storage failed");
              }

              const { uploadUrl: _uploadUrl, headers: _headers, strategy: _strategy, expiresInSeconds: _ttl, ...result } =
                presignBody;
              return result;
            })();

      onChange(data.url, data);
      setFilename(data.filename ?? file.name);
      toast.success("Resume uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const isUploaded = value.startsWith("/uploads/") || value.startsWith("/api/uploads/");
  const displayName = filename || (isUploaded ? value.split("/").pop() : null);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          type="url"
          placeholder="Paste a resume URL or upload a file"
          value={isUploaded ? "" : value}
          onChange={(e) => {
            onChange(e.target.value, null);
            setFilename(null);
          }}
          disabled={isUploaded}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4 mr-1" />
          )}
          Upload
        </Button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.txt,.rtf,application/pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {isUploaded && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
          <FileText className="w-3.5 h-3.5" />
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="flex-1 truncate hover:underline"
          >
            {displayName}
          </a>
          <button
            type="button"
            className="hover:text-foreground"
            onClick={() => {
              onChange("", null);
              setFilename(null);
            }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
