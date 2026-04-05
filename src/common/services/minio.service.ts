import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly client: Minio.Client;
  private readonly presignClient: Minio.Client;
  private readonly logger = new Logger(MinioService.name);
  private readonly publicEndpoint: string;
  private readonly publicPort: number;
  private readonly publicUseSSL: boolean;

  constructor(private configService: ConfigService) {
    const endPoint = this.configService.get('MINIO_ENDPOINT', 'localhost');
    const port = this.configService.get<number>('MINIO_PORT', 9000);
    const useSSL = this.configService.get('MINIO_USE_SSL', 'false') === 'true';
    const accessKey = this.configService.get('MINIO_ACCESS_KEY', 'minioadmin');
    const secretKey = this.configService.get('MINIO_SECRET_KEY', 'minioadmin');

    this.publicEndpoint = this.configService.get(
      'MINIO_PUBLIC_ENDPOINT',
      endPoint,
    );
    this.publicPort = this.configService.get<number>('MINIO_PUBLIC_PORT', port);
    this.publicUseSSL =
      this.configService.get(
        'MINIO_PUBLIC_USE_SSL',
        useSSL ? 'true' : 'false',
      ) === 'true';

    this.client = new Minio.Client({
      endPoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    });
    this.presignClient = new Minio.Client({
      endPoint: this.publicEndpoint,
      port: this.publicPort,
      useSSL: this.publicUseSSL,
      accessKey,
      secretKey,
      region: 'us-east-1',
    });
  }

  async onModuleInit() {
    await this.ensureBucket(
      this.configService.get<string>(
        'MINIO_EVALUATION_REPORTS_BUCKET',
        'evaluation-reports',
      ),
    );
  }

  private async ensureBucket(bucketName: string): Promise<void> {
    try {
      const exists = await this.client.bucketExists(bucketName);
      if (!exists) {
        await this.client.makeBucket(bucketName, 'us-east-1');
        this.logger.log(`Bucket '${bucketName}' created`);
      }
    } catch (error) {
      this.logger.warn(
        `Could not ensure bucket '${bucketName}': ${error.message}`,
      );
    }
  }

  async uploadFile(
    bucket: string,
    fileName: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    try {
      await this.client.putObject(bucket, fileName, buffer, buffer.length, {
        'Content-Type': contentType,
      });

      return this.buildObjectUrl(bucket, fileName);
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error.message}`);
      throw error;
    }
  }

  async getPresignedUrl(
    bucket: string,
    fileName: string,
    expiry = 3600,
  ): Promise<string> {
    try {
      return await this.presignClient.presignedGetObject(
        bucket,
        fileName,
        expiry,
      );
    } catch (error) {
      this.logger.error(`Failed to get presigned URL: ${error.message}`);
      throw error;
    }
  }

  private buildObjectUrl(bucket: string, fileName: string): string {
    const protocol = this.publicUseSSL ? 'https' : 'http';
    return `${protocol}://${this.publicEndpoint}:${this.publicPort}/${bucket}/${fileName}`;
  }

  async deleteFile(bucket: string, fileName: string): Promise<void> {
    try {
      await this.client.removeObject(bucket, fileName);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error.message}`);
      throw error;
    }
  }

  async fileExists(bucket: string, fileName: string): Promise<boolean> {
    try {
      await this.client.statObject(bucket, fileName);
      return true;
    } catch {
      return false;
    }
  }

  async getFileStream(
    bucket: string,
    fileName: string,
  ): Promise<NodeJS.ReadableStream> {
    try {
      return await this.client.getObject(bucket, fileName);
    } catch (error) {
      this.logger.error(`Failed to get file stream: ${error.message}`);
      throw error;
    }
  }

  async getFileStat(
    bucket: string,
    fileName: string,
  ): Promise<Minio.BucketItemStat> {
    return this.client.statObject(bucket, fileName);
  }
}
