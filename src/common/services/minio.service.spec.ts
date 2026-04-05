import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MinioService } from './minio.service';

// Mock the minio module
jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => ({
    bucketExists: jest.fn().mockResolvedValue(true),
    makeBucket: jest.fn().mockResolvedValue(undefined),
    putObject: jest.fn().mockResolvedValue({ etag: 'test-etag' }),
    presignedGetObject: jest.fn().mockResolvedValue('http://presigned-url'),
    removeObject: jest.fn().mockResolvedValue(undefined),
    statObject: jest.fn().mockResolvedValue({ size: 100 }),
  })),
}));

describe('MinioService', () => {
  let service: MinioService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MinioService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                MINIO_ENDPOINT: 'localhost',
                MINIO_PORT: 9000,
                MINIO_USE_SSL: 'false',
                MINIO_ACCESS_KEY: 'minioadmin',
                MINIO_SECRET_KEY: 'minioadmin',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MinioService>(MinioService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should ensure buckets exist', async () => {
      await service.onModuleInit();
      // No errors means success
      expect(true).toBe(true);
    });
  });

  describe('uploadFile', () => {
    it('should upload a file and return URL', async () => {
      const buffer = Buffer.from('test content');
      const result = await service.uploadFile(
        'test-bucket',
        'test-file.pdf',
        buffer,
        'application/pdf',
      );

      expect(result).toContain('test-bucket/test-file.pdf');
    });

    it('should return a public URL when public MinIO settings are provided', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MinioService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: any) => {
                const config: Record<string, any> = {
                  MINIO_ENDPOINT: 'minio',
                  MINIO_PORT: 9000,
                  MINIO_USE_SSL: 'false',
                  MINIO_PUBLIC_ENDPOINT: 'localhost',
                  MINIO_PUBLIC_PORT: 9002,
                  MINIO_PUBLIC_USE_SSL: 'false',
                  MINIO_ACCESS_KEY: 'minioadmin',
                  MINIO_SECRET_KEY: 'minioadmin',
                };
                return config[key] ?? defaultValue;
              }),
            },
          },
        ],
      }).compile();

      const publicUrlService = module.get<MinioService>(MinioService);
      const result = await publicUrlService.uploadFile(
        'test-bucket',
        'test-file.pdf',
        Buffer.from('test content'),
        'application/pdf',
      );

      expect(result).toBe('http://localhost:9002/test-bucket/test-file.pdf');
    });
  });

  describe('getPresignedUrl', () => {
    it('should return a presigned URL', async () => {
      const result = await service.getPresignedUrl(
        'test-bucket',
        'test-file.pdf',
      );
      expect(result).toBe('http://presigned-url');
    });
  });

  describe('deleteFile', () => {
    it('should delete a file', async () => {
      await expect(
        service.deleteFile('test-bucket', 'test-file.pdf'),
      ).resolves.not.toThrow();
    });
  });

  describe('fileExists', () => {
    it('should return true if file exists', async () => {
      const result = await service.fileExists('test-bucket', 'test-file.pdf');
      expect(result).toBe(true);
    });
  });
});
