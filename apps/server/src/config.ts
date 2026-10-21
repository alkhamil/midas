function env(name: string, fallback?: string): string {
    const v = process.env[name] ?? fallback;
    if (v === undefined) throw new Error(`Missing env ${name}`);
    return v;
}

export const config = {
    port: Number(env('PORT', '4000')),
    /** Interface to listen on; use 0.0.0.0 in a container / hosting service. */
    host: env('HOST', '127.0.0.1'),
    /** Apply pending database migrations at startup (hosting without a shell). */
    autoMigrate: env('AUTO_MIGRATE', 'false') === 'true',
    /** Built Studio (apps/studio/dist). When it exists the server serves it, so Studio and API share one origin. */
    studioDist: process.env.STUDIO_DIST ?? '',
    databaseUrl: env('DATABASE_URL', 'postgres://midas:midas@127.0.0.1:5433/midas'),
    s3: {
        endpoint: env('S3_ENDPOINT', 'http://127.0.0.1:8333'),
        region: env('S3_REGION', 'us-east-1'),
        accessKey: env('S3_ACCESS_KEY', 'midas'),
        secretKey: env('S3_SECRET_KEY', 'midas-secret'),
        bucket: env('S3_BUCKET', 'midas'),
    },
    bodyLimit: Number(env('BODY_LIMIT_MB', '512')) * 1024 * 1024,
    cookieSecure: env('COOKIE_SECURE', 'false') === 'true',
    sessionDays: 30,
};
