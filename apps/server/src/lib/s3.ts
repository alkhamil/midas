import { CreateBucketCommand, DeleteObjectsCommand, GetObjectCommand, HeadBucketCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { config } from '../config.js';

export const s3 = new S3Client({
    endpoint: config.s3.endpoint,
    region: config.s3.region,
    forcePathStyle: true,
    credentials: { accessKeyId: config.s3.accessKey, secretAccessKey: config.s3.secretKey },
});

export async function ensureBucket(): Promise<void> {
    try {
        await s3.send(new HeadBucketCommand({ Bucket: config.s3.bucket }));
    }
    catch {
        await s3.send(new CreateBucketCommand({ Bucket: config.s3.bucket }));
    }
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await s3.send(new PutObjectCommand({ Bucket: config.s3.bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function getObject(key: string): Promise<Buffer> {
    const res = await s3.send(new GetObjectCommand({ Bucket: config.s3.bucket, Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
}

export async function deletePrefix(prefix: string): Promise<void> {
    let token: string | undefined;
    do {
        const list = await s3.send(new ListObjectsV2Command({ Bucket: config.s3.bucket, Prefix: prefix, ContinuationToken: token }));
        const keys = (list.Contents ?? []).map(o => ({ Key: o.Key! }));
        if (keys.length)
            await s3.send(new DeleteObjectsCommand({ Bucket: config.s3.bucket, Delete: { Objects: keys } }));
        token = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (token);
}

export const assetKey = (fileId: string, assetId: string) => `files/${fileId}/assets/${assetId}`;
