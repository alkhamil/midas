import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from './index.js';
import { users, workspaceMembers, workspaces } from './schema.js';

/**
 * Seeder: the administrator account (the only way in on a fresh database: there is no sign-up).
 * Email / name / password come from SEED_ADMIN_EMAIL, SEED_ADMIN_NAME, SEED_ADMIN_PASSWORD. Without a password it is
 * `admin12345` outside production, and a random one printed once in production. An existing account is never
 * overwritten except that it is made an active administrator.
 */
export async function seedAdmin(): Promise<void> {
    const email = (process.env.SEED_ADMIN_EMAIL || 'admin@midas.local').trim().toLowerCase();
    const name = process.env.SEED_ADMIN_NAME || 'Administrator';
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
        if (existing.role !== 'admin' || !existing.active)
            await db.update(users).set({ role: 'admin', active: true, accessMode: 'all' }).where(eq(users.id, existing.id));
        return;
    }
    const generated = !process.env.SEED_ADMIN_PASSWORD && process.env.NODE_ENV === 'production';
    const password = process.env.SEED_ADMIN_PASSWORD || (generated ? randomBytes(9).toString('base64url') : 'admin12345');
    const passwordHash = await bcrypt.hash(password, 10);
    await db.transaction(async tx => {
        const [u] = await tx.insert(users).values({ email, name, passwordHash, role: 'admin', accessMode: 'all' }).returning();
        // One shared workspace: join the existing one, or create it.
        let [w] = await tx.select().from(workspaces).limit(1);
        if (!w)
            [w] = await tx.insert(workspaces).values({ name: 'Midas workspace' }).returning();
        await tx.insert(workspaceMembers).values({ workspaceId: w.id, userId: u.id, role: 'owner' });
    });
    console.log(`Seeded administrator ${email}${generated ? ` with password ${password} (change it now)` : ''}`);
}
