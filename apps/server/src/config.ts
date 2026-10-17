function env(name: string, fallback?: string): string {
    const v = process.env[name] ?? fallback;
    if (v === undefined) throw new Error(`Missing env ${name}`);
    return v;
}

export const config = {
    port: Number(env('PORT', '4000')),
    databaseUrl: env('DATABASE_URL', 'postgres://midas:midas@127.0.0.1:5433/midas'),
    s3: {
        endpoint: env('S3_ENDPOINT', 'http://127.0.0.1:8333'),
        region: env('S3_REGION', 'us-east-1'),
        accessKey: env('S3_ACCESS_KEY', 'midas'),
        secretKey: env('S3_SECRET_KEY', 'midas-secret'),
        bucket: env('S3_BUCKET', 'midas'),
    },
    bodyLimit: Number(env('BODY_LIMIT_MB', '512')) * 1024 * 1024,
    allowRegister: env('ALLOW_REGISTER', 'true') === 'true',
    cookieSecure: env('COOKIE_SECURE', 'false') === 'true',
    sessionDays: 30,
    /** Masa berlaku token CLI/CI (hari). */
    tokenDays: Number(env('TOKEN_DAYS', '365')),
    /** URL publik Midas API — ditulis ke midas.config.json repo paket. */
    publicUrl: env('MIDAS_PUBLIC_URL', 'http://127.0.0.1:4000'),
    /** URL Midas Registry (Verdaccio) untuk paket @midas/*. */
    registryUrl: env('REGISTRY_URL', 'http://127.0.0.1:4873/'),
};
