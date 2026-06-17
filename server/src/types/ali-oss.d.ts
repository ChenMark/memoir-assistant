declare module 'ali-oss' {
  interface OSSOptions {
    region: string;
    accessKeyId: string;
    accessKeySecret: string;
    bucket: string;
    secure?: boolean;
    endpoint?: string;
    internal?: boolean;
    cname?: boolean;
    timeout?: number;
  }

  interface PutObjectResult {
    name: string;
    url: string;
    res: {
      status: number;
      headers: Record<string, string>;
    };
  }

  interface SignatureUrlOptions {
    expires?: number;
    method?: string;
    'Content-Type'?: string;
    process?: string;
    response?: Record<string, string>;
  }

  class OSS {
    constructor(options: OSSOptions);
    put(name: string, file: string | Buffer, options?: Record<string, unknown>): Promise<PutObjectResult>;
    signatureUrl(name: string, options?: SignatureUrlOptions): string;
    delete(name: string): Promise<void>;
    deleteMulti(names: string[], options?: { quiet?: boolean }): Promise<{ deleted: string[] }>;
    get(name: string): Promise<{ content: Buffer; res: { status: number; headers: Record<string, string> } }>;
    list(query: { prefix?: string; 'max-keys'?: number; marker?: string; delimiter?: string }, options?: Record<string, unknown>): Promise<{ objects: Array<{ name: string; size: number; lastModified: string }>; prefixes?: string[]; nextMarker?: string; isTruncated?: boolean }>;
    head(name: string, options?: Record<string, unknown>): Promise<{ res: { status: number; headers: Record<string, string> }; meta: Record<string, string> }>;
  }

  export = OSS;
}
